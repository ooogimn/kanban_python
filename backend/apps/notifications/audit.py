"""
Хелпер для записи в AuditLog. Использует thread-local для текущего пользователя (устанавливается middleware).
"""
import threading
from .models import AuditLog

_thread_locals = threading.local()


def set_current_user(user):
    """Установить текущего пользователя для запроса (вызывается из middleware)."""
    _thread_locals.user = user


def get_current_user():
    """Получить текущего пользователя (из запроса) или None."""
    return getattr(_thread_locals, 'user', None)


def log_audit(action, model_name, object_id, user=None, changes=None):
    """
    Записать запись в журнал аудита.
    action: 'create' | 'update' | 'delete'
    model_name: строка, например 'project', 'workitem'
    object_id: id объекта
    user: пользователь (если None, берётся из get_current_user())
    changes: dict для хранения названия/полей (опционально)
    """
    if action not in (AuditLog.ACTION_CREATE, AuditLog.ACTION_UPDATE, AuditLog.ACTION_DELETE):
        return
    user = user or get_current_user()
    try:
        AuditLog.objects.create(
            action=action,
            model_name=model_name,
            object_id=object_id,
            user=user,
            changes=changes or {},
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning('AuditLog create failed: %s', e)
