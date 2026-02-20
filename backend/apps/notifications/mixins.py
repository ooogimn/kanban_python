"""
Миксин для установки текущего пользователя в thread-local после аутентификации DRF (JWT и др.).
Используется в ViewSet'ах, чтобы сигналы при create/update/destroy могли записать пользователя в AuditLog.
"""
from .audit import set_current_user


class AuditUserMixin:
    """Устанавливает request.user в thread-local после perform_authentication (для AuditLog в сигналах)."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.user and request.user.is_authenticated:
            set_current_user(request.user)
