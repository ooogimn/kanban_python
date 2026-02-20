"""
Функции для восстановления и смены пароля.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.hashers import make_password
from django.utils import timezone

from apps.core.models import User, VerificationCode
from .services import (
    TelegramService,
    generate_verification_code,
    get_verification_code_expiry,
    send_email_code
)
import logging

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_reset(request):
    """
    Запрос на восстановление пароля.
    Отправляет код подтверждения на email или в Telegram.
    
    POST body (JSON):
    {
        "identifier": "username" или "email" или "@telegram_username"
    }
    """
    data = request.data if getattr(request, 'data', None) else {}
    
    identifier = data.get('identifier', '').strip()
    if not identifier:
        return Response(
            {'detail': 'Необходимо указать username, email или telegram username.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Поиск пользователя
    user = None
    if identifier.startswith('@'):
        # Это telegram username с @
        try:
            user = User.objects.get(telegram_username=identifier[1:])
        except User.DoesNotExist:
            pass
    elif '@' in identifier and '.' in identifier:
        # Это email
        try:
            user = User.objects.get(email=identifier)
        except User.DoesNotExist:
            pass
    else:
        # Это может быть username или telegram_username без @
        try:
            user = User.objects.get(username=identifier)
        except User.DoesNotExist:
            try:
                user = User.objects.get(telegram_username=identifier)
            except User.DoesNotExist:
                pass
    
    if not user:
        # Не сообщаем, что пользователь не найден (безопасность)
        return Response(
            {'message': 'Если пользователь существует, код отправлен.'},
            status=status.HTTP_200_OK
        )
    
    # Генерация кода
    code = generate_verification_code()
    expires_at = get_verification_code_expiry()
    
    # Удаляем старые коды
    VerificationCode.objects.filter(
        user=user,
        code_type=VerificationCode.CODE_TYPE_PASSWORD_RESET,
        is_verified=False,
        expires_at__gt=timezone.now()
    ).delete()
    
    # Создаем новый код
    verification_code = VerificationCode.objects.create(
        code=code,
        code_type=VerificationCode.CODE_TYPE_PASSWORD_RESET,
        user=user,
        email=user.email,
        telegram_contact=f"@{user.telegram_username}" if user.telegram_username else None,
        expires_at=expires_at
    )
    
    # Отправка кода
    sent = False
    if user.email:
        sent = send_email_code(user.email, code)
    
    if user.telegram_username and not sent:
        telegram_service = TelegramService()
        sent = telegram_service.send_verification_code(f"@{user.telegram_username}", code)
    
    if not sent:
        verification_code.delete()
        return Response(
            {'detail': 'Не удалось отправить код подтверждения.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    return Response({
        'message': 'Код подтверждения отправлен.',
        'session_id': verification_code.id,
        'expires_at': expires_at.isoformat()
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    """
    Сброс пароля по коду подтверждения.
    
    POST body (JSON):
    {
        "session_id": 123,
        "code": "123456",
        "new_password": "new_secure_password"
    }
    """
    data = request.data if getattr(request, 'data', None) else {}
    
    required_fields = ['session_id', 'code', 'new_password']
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
    new_password = data['new_password']
    
    # Валидация пароля
    if len(new_password) < 8:
        return Response(
            {'detail': 'Пароль должен содержать минимум 8 символов.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Поиск кода
    try:
        verification_code = VerificationCode.objects.get(
            id=session_id,
            code=code,
            code_type=VerificationCode.CODE_TYPE_PASSWORD_RESET,
            is_verified=False
        )
    except VerificationCode.DoesNotExist:
        return Response(
            {'detail': 'Неверный код подтверждения.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not verification_code.user:
        return Response(
            {'detail': 'Неверный код подтверждения.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Проверка истечения
    if verification_code.is_expired():
        verification_code.delete()
        return Response(
            {'detail': 'Код подтверждения истек. Запросите новый код.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Смена пароля
    try:
        user = verification_code.user
        user.set_password(new_password)
        user.save(update_fields=['password'])
        
        # Отмечаем код как использованный
        verification_code.is_verified = True
        verification_code.save(update_fields=['is_verified'])
        
        # Генерация новых токенов
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email or '',
                'first_name': user.first_name or '',
                'last_name': user.last_name or '',
                'telegram_username': user.telegram_username or '',
            },
            'message': 'Пароль успешно изменен.'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.exception(f'Error resetting password: {e}')
        return Response(
            {'detail': 'Ошибка при смене пароля.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_password_change(request):
    """
    Запрос на смену пароля (для авторизованных пользователей).
    Отправляет код подтверждения на email или в Telegram.
    
    POST body (JSON):
    {
        "new_password": "new_secure_password"
    }
    """
    data = request.data if getattr(request, 'data', None) else {}
    new_password = data.get('new_password', '').strip()
    
    if not new_password:
        return Response(
            {'detail': 'Необходимо указать новый пароль.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if len(new_password) < 8:
        return Response(
            {'detail': 'Пароль должен содержать минимум 8 символов.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = request.user
    
    # Генерация кода
    code = generate_verification_code()
    expires_at = get_verification_code_expiry()
    
    # Сохранение хеша нового пароля
    password_hash = make_password(new_password)
    
    # Удаляем старые коды
    VerificationCode.objects.filter(
        user=user,
        code_type=VerificationCode.CODE_TYPE_PASSWORD_CHANGE,
        is_verified=False,
        expires_at__gt=timezone.now()
    ).delete()
    
    # Создаем новый код
    verification_code = VerificationCode.objects.create(
        code=code,
        code_type=VerificationCode.CODE_TYPE_PASSWORD_CHANGE,
        user=user,
        email=user.email,
        telegram_contact=f"@{user.telegram_username}" if user.telegram_username else None,
        password_hash=password_hash,
        expires_at=expires_at
    )
    
    # Отправка кода
    sent = False
    if user.email:
        sent = send_email_code(user.email, code)
    
    if user.telegram_username and not sent:
        telegram_service = TelegramService()
        sent = telegram_service.send_verification_code(f"@{user.telegram_username}", code)
    
    if not sent:
        verification_code.delete()
        return Response(
            {'detail': 'Не удалось отправить код подтверждения.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    return Response({
        'message': 'Код подтверждения отправлен.',
        'session_id': verification_code.id,
        'expires_at': expires_at.isoformat()
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """
    Смена пароля по коду подтверждения (для авторизованных пользователей).
    
    POST body (JSON):
    {
        "session_id": 123,
        "code": "123456"
    }
    """
    data = request.data if getattr(request, 'data', None) else {}
    
    required_fields = ['session_id', 'code']
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
    user = request.user
    
    # Поиск кода
    try:
        verification_code = VerificationCode.objects.get(
            id=session_id,
            code=code,
            code_type=VerificationCode.CODE_TYPE_PASSWORD_CHANGE,
            user=user,
            is_verified=False
        )
    except VerificationCode.DoesNotExist:
        return Response(
            {'detail': 'Неверный код подтверждения.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Проверка истечения
    if verification_code.is_expired():
        verification_code.delete()
        return Response(
            {'detail': 'Код подтверждения истек. Запросите новый код.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not verification_code.password_hash:
        return Response(
            {'detail': 'Ошибка: новый пароль не найден.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Смена пароля
    try:
        user.password = verification_code.password_hash
        user.save(update_fields=['password'])
        
        # Отмечаем код как использованный
        verification_code.is_verified = True
        verification_code.save(update_fields=['is_verified'])
        
        return Response({
            'message': 'Пароль успешно изменен.'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.exception(f'Error changing password: {e}')
        return Response(
            {'detail': 'Ошибка при смене пароля.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
