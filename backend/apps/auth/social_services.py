import hashlib
import secrets
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import transaction
from django.utils.text import slugify
from rest_framework.exceptions import ValidationError

from apps.core.models import SocialIdentity

User = get_user_model()

SOCIAL_STATE_CACHE_KEY = 'social-auth:state:{state}'


@dataclass
class SocialProfile:
    provider: str
    provider_user_id: str
    email: str | None = None
    email_verified: bool = False
    first_name: str = ''
    last_name: str = ''
    username: str = ''
    raw: dict[str, Any] | None = None


class SocialStateService:
    @staticmethod
    def create(provider: str, next_path: str = '/login') -> dict[str, str]:
        state = secrets.token_urlsafe(24)
        nonce = secrets.token_urlsafe(24)
        payload = {
            'provider': provider,
            'next_path': next_path,
            'nonce': nonce,
        }
        ttl = int(getattr(settings, 'SOCIAL_AUTH_STATE_TTL_SEC', 600))
        cache.set(SOCIAL_STATE_CACHE_KEY.format(state=state), payload, ttl)
        return {'state': state, 'nonce': nonce}

    @staticmethod
    def get(state: str) -> dict[str, str] | None:
        if not state:
            return None
        return cache.get(SOCIAL_STATE_CACHE_KEY.format(state=state))

    @staticmethod
    def pop(state: str) -> dict[str, str] | None:
        key = SOCIAL_STATE_CACHE_KEY.format(state=state)
        payload = cache.get(key)
        if payload:
            cache.delete(key)
        return payload


def _derive_username(profile: SocialProfile) -> str:
    base = profile.username or profile.email or f'{profile.provider}_{profile.provider_user_id}'
    base = base.split('@')[0]
    normalized = slugify(base).replace('-', '_')[:120] or f'{profile.provider}_user'
    candidate = normalized
    idx = 1
    while User.objects.filter(username=candidate).exists():
        candidate = f'{normalized[:110]}_{idx}'
        idx += 1
    return candidate


def build_auth_payload(user: User, provider: str, is_new_user: bool = False) -> dict[str, Any]:
    from rest_framework_simplejwt.tokens import RefreshToken

    refresh = RefreshToken.for_user(user)
    groups = list(user.groups.values_list('name', flat=True))
    has_password = bool(user.password) and user.has_usable_password()
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email or '',
            'first_name': user.first_name or '',
            'last_name': user.last_name or '',
            'telegram_username': user.telegram_username or '',
            'groups': groups,
            'is_onboarded': getattr(user, 'is_onboarded', False),
        },
        'auth_provider': provider,
        'is_new_user': is_new_user,
        'needs_password_setup': not has_password,
    }


class IdentityLinkingService:
    @staticmethod
    @transaction.atomic
    def find_or_create_user_by_social(profile: SocialProfile) -> tuple[User, bool]:
        social = SocialIdentity.objects.filter(
            provider=profile.provider,
            provider_user_id=str(profile.provider_user_id),
        ).select_related('user').first()
        if social:
            IdentityLinkingService._sync_social_identity(social, profile)
            return social.user, False

        # Безопасный merge: только если email верифицирован у провайдера.
        existing_user = None
        if profile.email and profile.email_verified:
            existing_user = User.objects.filter(email__iexact=profile.email).first()

        if existing_user:
            user = existing_user
            created = False
        else:
            user = User.objects.create_user(
                username=_derive_username(profile),
                email=profile.email or '',
                first_name=profile.first_name or '',
                last_name=profile.last_name or '',
                password=None,
                is_active=True,
            )
            user.set_unusable_password()
            user.save(update_fields=['password'])
            created = True

        SocialIdentity.objects.create(
            user=user,
            provider=profile.provider,
            provider_user_id=str(profile.provider_user_id),
            email=profile.email or None,
            is_email_verified=bool(profile.email_verified),
            raw_profile=profile.raw or {},
        )
        return user, created

    @staticmethod
    @transaction.atomic
    def link_social_to_user(user: User, profile: SocialProfile) -> SocialIdentity:
        social = SocialIdentity.objects.filter(
            provider=profile.provider,
            provider_user_id=str(profile.provider_user_id),
        ).first()
        if social and social.user_id != user.id:
            raise ValidationError('Этот социальный аккаунт уже привязан к другому пользователю.')
        if social:
            IdentityLinkingService._sync_social_identity(social, profile)
            return social

        return SocialIdentity.objects.create(
            user=user,
            provider=profile.provider,
            provider_user_id=str(profile.provider_user_id),
            email=profile.email or None,
            is_email_verified=bool(profile.email_verified),
            raw_profile=profile.raw or {},
        )

    @staticmethod
    def _sync_social_identity(social: SocialIdentity, profile: SocialProfile) -> None:
        changed = False
        email = profile.email or None
        if social.email != email:
            social.email = email
            changed = True
        if social.is_email_verified != bool(profile.email_verified):
            social.is_email_verified = bool(profile.email_verified)
            changed = True
        if (profile.raw or {}) and social.raw_profile != (profile.raw or {}):
            social.raw_profile = profile.raw or {}
            changed = True
        if changed:
            social.save(update_fields=['email', 'is_email_verified', 'raw_profile', 'updated_at'])
