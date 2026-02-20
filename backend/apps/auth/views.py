"""
Authentication views for Office Suite 360.
"""
import hashlib
import hmac
import logging
import os
import time

from django.conf import settings
from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.core.models import UserEvent, VerificationCode
from .services import (
    TelegramService, 
    generate_verification_code, 
    get_verification_code_expiry,
    send_email_code
)

User = get_user_model()
logger = logging.getLogger(__name__)

# Макс. возраст auth_date (секунды) для защиты от replay
TELEGRAM_AUTH_MAX_AGE = 86400  # 24 часа


def _verify_telegram_login_hash(payload: dict, bot_token: str) -> bool:
    """
    Верификация hash от Telegram Login Widget.
    https://core.telegram.org/widgets/login#checking-authorization
    """
    received_hash = payload.pop('hash', None)
    if not received_hash or not bot_token:
        return False
    data_check_list = [f'{k}={v}' for k, v in sorted(payload.items())]
    data_check_string = '\n'.join(data_check_list)
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    calculated = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(calculated, received_hash)


@api_view(['POST'])
@permission_classes([AllowAny])
def telegram_login(request):
    """
    Авторизация через Telegram Login Widget.

    POST body (JSON): id, first_name, last_name?, username?, photo_url?, auth_date, hash.
    Верифицирует hash, создаёт/обновляет пользователя, возвращает JWT.
    """
    bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None) or os.environ.get('TELEGRAM_BOT_TOKEN')
    if not bot_token:
        logger.warning('TELEGRAM_BOT_TOKEN not set')
        return Response(
            {'detail': 'Telegram login is not configured.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    data = request.data if getattr(request, 'data', None) else {}
    if not data:
        try:
            import json
            data = json.loads(request.body.decode()) if request.body else {}
        except Exception:
            pass
    if not isinstance(data, dict):
        return Response(
            {'detail': 'Invalid payload.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    for key in ('id', 'auth_date', 'hash'):
        if key not in data:
            return Response(
                {'detail': f'Missing required field: {key}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

    auth_date = int(data['auth_date'])
    if abs(time.time() - auth_date) > TELEGRAM_AUTH_MAX_AGE:
        return Response(
            {'detail': 'Telegram auth data expired.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    payload = {k: v for k, v in data.items() if k != 'hash'}
    payload['auth_date'] = str(payload['auth_date'])
    payload['id'] = str(payload['id'])
    if not _verify_telegram_login_hash(dict(payload), bot_token):
        return Response(
            {'detail': 'Invalid Telegram hash.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    tg_id = int(data['id'])
    first_name = data.get('first_name') or ''
    last_name = data.get('last_name') or ''
    username = (data.get('username') or '').strip()
    base_username = f"tg_{tg_id}"

    user, created = User.objects.get_or_create(
        telegram_id=tg_id,
        defaults={
            'username': base_username,
            'first_name': first_name,
            'last_name': last_name,
            'telegram_username': username or None,
            'is_active': True,
        }
    )
    if not created:
        updated = False
        if user.first_name != first_name:
            user.first_name = first_name
            updated = True
        if user.last_name != last_name:
            user.last_name = last_name
            updated = True
        if user.telegram_username != (username or None):
            user.telegram_username = username or None
            updated = True
        if updated:
            user.save(update_fields=['first_name', 'last_name', 'telegram_username'])

    refresh = RefreshToken.for_user(user)
    groups = list(user.groups.values_list('name', flat=True))
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'telegram_username': user.telegram_username,
            'groups': groups,
            'is_onboarded': getattr(user, 'is_onboarded', False),
        }
    }, status=status.HTTP_200_OK)


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Кастомный view для получения JWT токенов.
    Поддерживает вход по username, email или telegram_username.
    Возвращает дополнительную информацию о пользователе.
    """
    
    def post(self, request, *args, **kwargs):
        # Получаем username из запроса
        identifier = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        
        if not identifier or not password:
            return Response(
                {'detail': 'Необходимо указать username и password.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Пытаемся найти пользователя по username, email или telegram_username
        user = None
        
        # Приоритет 1: Если начинается с @ - это telegram username
        if identifier.startswith('@'):
            telegram_username = identifier[1:]
            try:
                user = User.objects.get(telegram_username=telegram_username)
            except User.DoesNotExist:
                pass
            except User.MultipleObjectsReturned:
                user = User.objects.filter(telegram_username=telegram_username).first()
        
        # Приоритет 2: Если содержит @ и точку - это email
        elif '@' in identifier and '.' in identifier:
            try:
                user = User.objects.get(email=identifier)
            except User.DoesNotExist:
                pass
            except User.MultipleObjectsReturned:
                user = User.objects.filter(email=identifier).first()
        
        # Приоритет 3: Сначала ищем по username (основной способ для суперпользователей)
        else:
            try:
                user = User.objects.get(username=identifier)
            except User.DoesNotExist:
                # Если не найден по username, пробуем telegram_username без @
                try:
                    user = User.objects.get(telegram_username=identifier)
                except User.DoesNotExist:
                    pass
                except User.MultipleObjectsReturned:
                    user = User.objects.filter(telegram_username=identifier).first()
            except User.MultipleObjectsReturned:
                user = User.objects.filter(username=identifier).first()
        
        if not user:
            return Response(
                {'detail': 'Неверные учетные данные.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Используем стандартную аутентификацию Django для проверки пароля
        # Это важно для корректной работы с суперпользователями
        authenticated_user = authenticate(
            request=request,
            username=user.username,  # authenticate всегда использует username
            password=password
        )
        
        if not authenticated_user:
            return Response(
                {'detail': 'Неверные учетные данные.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Проверяем, что пользователь активен
        if not authenticated_user.is_active:
            return Response(
                {'detail': 'Аккаунт неактивен.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Записываем событие входа для аналитики
        UserEvent.objects.create(user=authenticated_user, event_type=UserEvent.EVENT_LOGIN)

        # Генерируем токены
        refresh = RefreshToken.for_user(authenticated_user)
        groups = list(authenticated_user.groups.values_list('name', flat=True))
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': authenticated_user.id,
                'username': authenticated_user.username,
                'email': authenticated_user.email or '',
                'first_name': authenticated_user.first_name or '',
                'last_name': authenticated_user.last_name or '',
                'telegram_username': authenticated_user.telegram_username or '',
                'groups': groups,
                'is_onboarded': getattr(authenticated_user, 'is_onboarded', False),
            }
        }, status=status.HTTP_200_OK)


class CustomTokenRefreshView(TokenRefreshView):
    """
    Кастомный view для обновления JWT токенов.
    """
    pass


def _user_to_profile_data(user, request=None):
    """Сформировать данные профиля для ответа API (использует UserSerializer)."""
    from apps.core.serializers import UserSerializer
    serializer = UserSerializer(user, context={'request': request})
    return serializer.data


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def finish_onboarding(request):
    """
    Завершение онбординга: помечает is_onboarded=True у текущего пользователя.
    POST /api/v1/users/finish-onboarding/
    Возвращает обновлённый профиль (200).
    """
    user = request.user
    user.is_onboarded = True
    user.save(update_fields=['is_onboarded'])
    return Response(_user_to_profile_data(user, request), status=status.HTTP_200_OK)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def profile_me(request):
    """
    Личный кабинет: GET — данные текущего пользователя, PATCH — обновление профиля.
    """
    user = request.user
    if request.method == 'GET':
        return Response(_user_to_profile_data(user, request))

    # PATCH — обновление полей профиля и/или аватара
    from apps.core.serializers import UserSerializer
    from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
    data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data or {})
    if request.FILES.get('avatar'):
        data['avatar_file'] = request.FILES.get('avatar')
    serializer = UserSerializer(user, data=data, partial=True, context={'request': request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    Регистрация нового пользователя.
    
    POST body (JSON):
    {
        "username": "user123",
        "password": "secure_password",
        "email": "user@example.com",
        "telegram_contact": "@username" или "+79991234567",
        "invite_token": "uuid"  // опционально: при регистрации по приглашению
    }
    
    При наличии invite_token: email берётся из приглашения (можно не передавать),
    после создания пользователя вызывается InvitationService.process_acceptance.
    """
    data = request.data if getattr(request, 'data', None) else {}
    invite_token = data.get('invite_token') or None
    if invite_token:
        invite_token = str(invite_token).strip()

    required_fields = ['username', 'password', 'telegram_contact']
    for field in required_fields:
        if field not in data or not data[field] or not str(data[field]).strip():
            return Response(
                {'detail': f'Поле "{field}" обязательно для заполнения.'},
                status=status.HTTP_400_BAD_REQUEST
            )

    email = (data.get('email') or '').strip()
    if invite_token:
        from apps.hr.models import Invitation
        try:
            inv = Invitation.objects.select_related('contact', 'workspace').get(token=invite_token)
        except Invitation.DoesNotExist:
            return Response({'detail': 'Приглашение не найдено.'}, status=status.HTTP_400_BAD_REQUEST)
        if inv.status != Invitation.STATUS_PENDING or timezone.now() > inv.expires_at:
            return Response({'detail': 'Приглашение недействительно или истекло.'}, status=status.HTTP_400_BAD_REQUEST)
        email = inv.email
    else:
        if not email:
            return Response(
                {'detail': 'Поле "email" обязательно для заполнения.'},
                status=status.HTTP_400_BAD_REQUEST
            )

    username = data['username'].strip()
    password = data['password']
    telegram_contact = data['telegram_contact'].strip()

    if '@' not in email:
        return Response(
            {'detail': 'Некорректный формат email.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if User.objects.filter(username=username).exists():
        return Response(
            {'detail': 'Пользователь с таким именем уже существует.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if User.objects.filter(email=email).exists():
        return Response(
            {'detail': 'Пользователь с таким email уже существует.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not telegram_contact.startswith('@') and not telegram_contact.startswith('+'):
        telegram_contact = f"@{telegram_contact}"

    telegram_username = telegram_contact[1:] if telegram_contact.startswith('@') else telegram_contact
    if User.objects.filter(telegram_username=telegram_username).exists():
        return Response(
            {'detail': 'Пользователь с таким Telegram username уже существует.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if len(password) < 8:
        return Response(
            {'detail': 'Пароль должен содержать минимум 8 символов.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            is_active=True
        )
        user.telegram_username = telegram_username
        user.save(update_fields=['telegram_username'])

        if invite_token:
            from apps.hr.services import process_acceptance
            try:
                process_acceptance(user, invite_token)
            except ValueError as e:
                logger.warning(f"Invite process_acceptance after register: {e}")
                # Пользователь уже создан — не откатываем, просто не привязываем контакт

        refresh = RefreshToken.for_user(user)
        groups = list(user.groups.values_list('name', flat=True))
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'telegram_username': user.telegram_username,
                'groups': groups,
                'is_onboarded': getattr(user, 'is_onboarded', False),
            }
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.exception(f'Error creating user: {e}')
        return Response(
            {'detail': 'Ошибка при создании пользователя.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_code(request):
    """
    Подтверждение кода и создание пользователя.
    
    POST body (JSON):
    {
        "session_id": 123,
        "code": "123456",
        "telegram_contact": "@username" или "+79991234567"
    }
    
    При успешном подтверждении создает пользователя и возвращает JWT токены.
    """
    data = request.data if getattr(request, 'data', None) else {}
    
    required_fields = ['session_id', 'code', 'telegram_contact']
    for field in required_fields:
        if field not in data:
            return Response(
                {'detail': f'Поле "{field}" обязательно для заполнения.'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    try:
        session_id = int(data['session_id'])
    except (ValueError, TypeError):
        return Response(
            {'detail': 'Неверный формат session_id.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    code = data['code'].strip()
    telegram_contact = data['telegram_contact'].strip()
    
    # Нормализация telegram_contact
    if not telegram_contact.startswith('@') and not telegram_contact.startswith('+'):
        telegram_contact = f"@{telegram_contact}"
    
    # Поиск кода подтверждения
    try:
        verification_code = VerificationCode.objects.get(
            id=session_id,
            code=code,
            telegram_contact=telegram_contact,
            is_verified=False
        )
    except VerificationCode.DoesNotExist:
        return Response(
            {'detail': 'Неверный код подтверждения или session_id.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Проверка истечения срока действия
    if verification_code.is_expired():
        verification_code.delete()
        return Response(
            {'detail': 'Код подтверждения истек. Запросите новый код.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Проверка, не создан ли уже пользователь с таким username
    if User.objects.filter(username=verification_code.username).exists():
        verification_code.delete()
        return Response(
            {'detail': 'Пользователь с таким именем уже существует.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Создание пользователя
    try:
        # Создаем пользователя без пароля, затем устанавливаем хеш напрямую
        user = User(
            username=verification_code.username,
            email=verification_code.email,
            is_active=True
        )
        # Устанавливаем уже хешированный пароль
        user.password = verification_code.password_hash
        user.save()
        
        # Сохраняем telegram_username если это username
        if telegram_contact.startswith('@'):
            user.telegram_username = telegram_contact[1:]  # Убираем @
            user.save(update_fields=['telegram_username'])
        
        # Отмечаем код как использованный
        verification_code.is_verified = True
        verification_code.save(update_fields=['is_verified'])
        
        # Генерация JWT токенов
        refresh = RefreshToken.for_user(user)
        groups = list(user.groups.values_list('name', flat=True))
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'telegram_username': user.telegram_username,
                'groups': groups,
                'is_onboarded': getattr(user, 'is_onboarded', False),
            }
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.exception(f'Error creating user: {e}')
        return Response(
            {'detail': 'Ошибка при создании пользователя.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def telegram_link(request):
    """
    Привязка Telegram к аккаунту. Два варианта:

    1) Без body или без поля code: генерирует ссылку (Deep Link).
       Возвращает token и link для t.me/Bot?start=TOKEN.
       Пользователь открывает ссылку в Telegram — аккаунт связывается.

    2) С полем code: пользователь ввёл код, выданный ботом по /start.
       Возвращает success при успешной привязке.
    """
    import secrets
    from apps.bot.services import set_link_token, get_bot_link_code, clear_bot_link_code

    code = (request.data.get('code') or '').strip() if isinstance(request.data, dict) else None

    if code:
        # Привязка по коду из бота (пользователь ввёл код на сайте)
        data = get_bot_link_code(code)
        if not data:
            return Response(
                {'detail': 'Код истёк или неверный. Отправьте /start боту и введите новый код.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        telegram_id = data.get('telegram_id')
        telegram_username = data.get('telegram_username') or ''
        if not telegram_id:
            return Response(
                {'detail': 'Неверный код.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = request.user
        user.telegram_id = telegram_id
        user.telegram_username = telegram_username
        user.save(update_fields=['telegram_id', 'telegram_username'])
        clear_bot_link_code(code)
        return Response(
            {'detail': 'Telegram успешно привязан.', 'telegram_id': telegram_id},
            status=status.HTTP_200_OK,
        )

    # Генерация ссылки (Deep Link)
    bot_username = getattr(settings, 'TELEGRAM_BOT_USERNAME', '') or ''
    if not bot_username:
        return Response(
            {'detail': 'Telegram bot is not configured (TELEGRAM_BOT_USERNAME).'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    token = secrets.token_urlsafe(24)[:48]
    set_link_token(token, request.user.id)

    link = f'https://t.me/{bot_username}?start={token}'
    return Response({'token': token, 'link': link}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def invite_token_info(request, token):
    """
    Валидация токена приглашения (HR-SPRINT 3).
    GET /api/v1/auth/invite/<token>/
    Возвращает email, workspace_name, contact_name для предзаполнения регистрации.
    """
    from apps.hr.models import Invitation

    try:
        inv = Invitation.objects.select_related('contact', 'workspace').get(token=token)
    except Invitation.DoesNotExist:
        return Response({'detail': 'Приглашение не найдено.'}, status=status.HTTP_404_NOT_FOUND)

    if inv.status != Invitation.STATUS_PENDING:
        return Response({'detail': 'Приглашение уже использовано или отменено.'}, status=status.HTTP_400_BAD_REQUEST)

    if timezone.now() > inv.expires_at:
        return Response({'detail': 'Срок действия приглашения истёк.'}, status=status.HTTP_400_BAD_REQUEST)

    contact = inv.contact
    name = f"{contact.first_name or ''} {contact.last_name or ''}".strip() or contact.email or f"Контакт #{contact.id}"
    return Response({
        'email': inv.email,
        'workspace_name': inv.workspace.name,
        'contact_name': name,
        'valid': True,
    }, status=status.HTTP_200_OK)


# Импорт функций для восстановления и смены пароля
from .views_password import (
    request_password_reset,
    reset_password,
    request_password_change,
    change_password,
)
