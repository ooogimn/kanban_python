"""
Middleware для установки текущего пользователя в thread-local (для AuditLog в сигналах).
Используется при обработке HTTP-запросов; для DRF пользователь устанавливается после аутентификации в миксине.
"""
from .audit import set_current_user


class AuditRequestMiddleware:
    """
    Устанавливает request.user в thread-local после аутентификации Django (сессии).
    Для JWT-запросов пользователь устанавливается в AuditUserMixin в ViewSet.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        set_current_user(getattr(request, 'user', None))
        try:
            return self.get_response(request)
        finally:
            set_current_user(None)
