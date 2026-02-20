"""
Middleware для аутентификации WebSocket через JWT.
"""
from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
import jwt
from django.conf import settings

User = get_user_model()


@database_sync_to_async
def get_user_from_token(token):
    """Получение пользователя из JWT токена."""
    try:
        # Декодируем токен
        UntypedToken(token)
        decoded_data = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = decoded_data.get('user_id')
        
        if user_id:
            try:
                return User.objects.get(id=user_id)
            except User.DoesNotExist:
                return AnonymousUser()
    except (InvalidToken, TokenError, Exception):
        return AnonymousUser()
    
    return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Middleware для аутентификации WebSocket через JWT токен.
    
    Токен передаётся в query string: ws://host/ws/path/?token=...
    """
    
    async def __call__(self, scope, receive, send):
        # Извлекаем токен из query string
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]
        
        if token:
            scope['user'] = await get_user_from_token(token)
        else:
            scope['user'] = AnonymousUser()
        
        return await super().__call__(scope, receive, send)
