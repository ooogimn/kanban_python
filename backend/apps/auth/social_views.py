import logging
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.http import HttpResponseRedirect
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.core.models import UserEvent

from .social_services import (
    IdentityLinkingService,
    SocialProfile,
    SocialStateService,
    build_auth_payload,
)

logger = logging.getLogger(__name__)


def _provider_config(provider: str) -> dict | None:
    providers = getattr(settings, 'SOCIAL_AUTH_PROVIDERS', {})
    return providers.get(provider)


def _backend_callback_url(provider: str) -> str:
    return f"{settings.BACKEND_PUBLIC_URL.rstrip('/')}/api/v1/auth/social/{provider}/callback/"


def _frontend_redirect(next_path: str) -> str:
    safe_paths = set(getattr(settings, 'SOCIAL_AUTH_ALLOWED_FRONTEND_PATHS', ['/login']))
    if next_path not in safe_paths:
        next_path = '/login'
    return f"{settings.FRONTEND_URL.rstrip('/')}{next_path}"


@api_view(['GET'])
@permission_classes([AllowAny])
def social_providers(request):
    result = {}
    for key, cfg in getattr(settings, 'SOCIAL_AUTH_PROVIDERS', {}).items():
        result[key] = bool(cfg.get('enabled') and cfg.get('client_id') and cfg.get('client_secret'))
    # Telegram может быть включен без client_secret
    tg_enabled = bool(getattr(settings, 'TELEGRAM_BOT_TOKEN', ''))
    result['telegram'] = result.get('telegram', False) or tg_enabled
    return Response({'providers': result}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def social_start(request, provider: str):
    provider = provider.lower()
    cfg = _provider_config(provider)
    if not cfg or not cfg.get('enabled'):
        return Response({'detail': 'Провайдер отключён.'}, status=status.HTTP_400_BAD_REQUEST)
    if not cfg.get('client_id'):
        return Response({'detail': 'Провайдер не настроен.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    next_path = request.query_params.get('next') or '/login'
    state_data = SocialStateService.create(provider=provider, next_path=next_path)

    query = {
        'client_id': cfg['client_id'],
        'redirect_uri': _backend_callback_url(provider),
        'response_type': 'code',
        'scope': ' '.join(cfg.get('scopes', [])),
        'state': state_data['state'],
    }
    if cfg.get('use_nonce'):
        query['nonce'] = state_data['nonce']

    auth_url = f"{cfg['authorize_url']}?{urlencode(query)}"
    return Response(
        {
            'provider': provider,
            'auth_url': auth_url,
            'state': state_data['state'],
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def social_callback(request, provider: str):
    provider = provider.lower()
    state = request.query_params.get('state') or ''
    code = request.query_params.get('code') or ''
    error = request.query_params.get('error') or ''
    state_payload = SocialStateService.get(state)
    next_path = (state_payload or {}).get('next_path', '/login')
    redirect_base = _frontend_redirect(next_path)

    params = {'social_provider': provider}
    if state:
        params['state'] = state
    if code:
        params['code'] = code
    if error:
        params['error'] = error
    return HttpResponseRedirect(f"{redirect_base}?{urlencode(params)}")


def _exchange_code_for_tokens(provider: str, code: str, state_nonce: str | None = None) -> dict:
    cfg = _provider_config(provider)
    if not cfg:
        raise ValueError('Unknown provider')

    payload = {
        'grant_type': 'authorization_code',
        'code': code,
        'client_id': cfg['client_id'],
        'client_secret': cfg['client_secret'],
        'redirect_uri': _backend_callback_url(provider),
    }
    response = requests.post(cfg['token_url'], data=payload, timeout=15)
    response.raise_for_status()
    data = response.json()
    # Базовая проверка nonce для OIDC провайдеров при наличии id_token можно добавить здесь.
    _ = state_nonce
    return data


def _fetch_profile(provider: str, token_data: dict) -> SocialProfile:
    access_token = token_data.get('access_token')
    if not access_token:
        raise ValueError('access_token missing')

    if provider == 'google':
        userinfo = requests.get(
            'https://openidconnect.googleapis.com/v1/userinfo',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=15,
        )
        userinfo.raise_for_status()
        d = userinfo.json()
        return SocialProfile(
            provider='google',
            provider_user_id=str(d.get('sub', '')),
            email=d.get('email'),
            email_verified=bool(d.get('email_verified')),
            first_name=d.get('given_name') or '',
            last_name=d.get('family_name') or '',
            username=(d.get('email') or '').split('@')[0] if d.get('email') else '',
            raw=d,
        )

    if provider == 'yandex':
        userinfo = requests.get(
            'https://login.yandex.ru/info',
            headers={'Authorization': f'OAuth {access_token}'},
            timeout=15,
        )
        userinfo.raise_for_status()
        d = userinfo.json()
        return SocialProfile(
            provider='yandex',
            provider_user_id=str(d.get('id', '')),
            email=d.get('default_email'),
            email_verified=bool(d.get('default_email')),
            first_name=d.get('first_name') or '',
            last_name=d.get('last_name') or '',
            username=d.get('login') or '',
            raw=d,
        )

    if provider == 'vk':
        userinfo = requests.get(
            'https://api.vk.com/method/users.get',
            params={
                'v': '5.199',
                'access_token': access_token,
                'fields': 'screen_name',
            },
            timeout=15,
        )
        userinfo.raise_for_status()
        d = userinfo.json()
        item = ((d.get('response') or [{}])[0]) if isinstance(d, dict) else {}
        email = token_data.get('email')
        return SocialProfile(
            provider='vk',
            provider_user_id=str(item.get('id', '')),
            email=email,
            email_verified=bool(email),
            first_name=item.get('first_name') or '',
            last_name=item.get('last_name') or '',
            username=item.get('screen_name') or '',
            raw={'token': token_data, 'user': d},
        )

    if provider == 'mail':
        userinfo = requests.get(
            'https://oauth.mail.ru/userinfo',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=15,
        )
        userinfo.raise_for_status()
        d = userinfo.json()
        email = d.get('email')
        return SocialProfile(
            provider='mail',
            provider_user_id=str(d.get('id', '')),
            email=email,
            email_verified=bool(email),
            first_name=d.get('first_name') or '',
            last_name=d.get('last_name') or '',
            username=(email or '').split('@')[0] if email else '',
            raw=d,
        )

    raise ValueError('Unsupported provider')


@api_view(['POST'])
@permission_classes([AllowAny])
def social_exchange(request, provider: str):
    provider = provider.lower()
    cfg = _provider_config(provider)
    if not cfg or not cfg.get('enabled'):
        return Response({'detail': 'Провайдер отключён.'}, status=status.HTTP_400_BAD_REQUEST)

    code = (request.data or {}).get('code')
    state = (request.data or {}).get('state')
    if not code or not state:
        return Response({'detail': 'code и state обязательны.'}, status=status.HTTP_400_BAD_REQUEST)

    state_payload = SocialStateService.pop(state)
    if not state_payload or state_payload.get('provider') != provider:
        return Response({'detail': 'Неверный или истёкший state.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        token_data = _exchange_code_for_tokens(provider, code, state_payload.get('nonce'))
        profile = _fetch_profile(provider, token_data)
        if not profile.provider_user_id:
            return Response({'detail': 'Провайдер не вернул user id.'}, status=status.HTTP_400_BAD_REQUEST)
        user, is_new = IdentityLinkingService.find_or_create_user_by_social(profile)
        UserEvent.objects.create(
            user=user,
            event_type=UserEvent.EVENT_LOGIN,
            details={'provider': provider, 'is_new_user': is_new},
        )
        return Response(build_auth_payload(user, provider=provider, is_new_user=is_new), status=status.HTTP_200_OK)
    except requests.HTTPError as exc:
        logger.warning('OAuth HTTP error for provider %s: %s', provider, exc)
        return Response({'detail': 'Ошибка провайдера OAuth.'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:
        logger.exception('Social auth failed for provider %s: %s', provider, exc)
        return Response({'detail': 'Ошибка социального входа.'}, status=status.HTTP_400_BAD_REQUEST)
