"""
Права доступа HR: контакты.
Чтение — участники Workspace; запись — Owner (Директор) или Guarantor контакта.
"""
from typing import Optional

from rest_framework import permissions

from apps.core.models import WorkspaceMember


def is_manager_for_contact(user, contact) -> bool:
    """
    Проверяет, может ли пользователь управлять контактом (создание/редактирование/удаление).
    True если: пользователь — владелец workspace контакта, или Директор (активная подписка), или поручитель контакта.
    """
    if not user or not user.is_authenticated or not contact:
        return False
    # Суперпользователь — полный доступ
    if getattr(user, 'is_superuser', False):
        return True
    # Поручитель этого контакта
    if contact.guarantor_id == user.id:
        return True
    # Владелец workspace контакта
    if WorkspaceMember.objects.filter(
        workspace_id=contact.workspace_id,
        user=user,
        role=WorkspaceMember.ROLE_OWNER,
    ).exists():
        return True
    # Директор по подписке (активная подписка = владелец аккаунта)
    try:
        from apps.billing.models import Subscription
        sub = Subscription.objects.filter(user=user, is_active=True).first()
        if sub and sub.plan != Subscription.PLAN_FREE:
            # Pro/Enterprise — директор; для free считаем директором только если он owner workspace
            return True
    except Exception:
        pass
    return False


def is_workspace_member(user, workspace_id: Optional[int]) -> bool:
    """Пользователь является участником workspace (любая роль)."""
    if not user or not user.is_authenticated or not workspace_id:
        return False
    if getattr(user, 'is_staff', False):
        return True
    return WorkspaceMember.objects.filter(
        workspace_id=workspace_id,
        user=user,
    ).exists()


class ContactPermission(permissions.BasePermission):
    """
    Чтение: участники Workspace.
    Запись (create/update/destroy): только Owner (Директор) или Guarantor для контакта.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            workspace_id = view.kwargs.get('workspace_id') or request.query_params.get('workspace_id')
            if request.method == 'GET' and not view.detail:
                return is_workspace_member(request.user, workspace_id)
            return True
        # POST: проверка по workspace_id из тела/query
        workspace_id = (
            request.data.get('workspace') if hasattr(request, 'data') and request.data else None
        ) or request.query_params.get('workspace_id')
        if not workspace_id:
            return True  # объектная проверка в has_object_permission или 400 в create
        # Запись разрешена только владельцу workspace или директору
        if getattr(request.user, 'is_superuser', False):
            return True
        if WorkspaceMember.objects.filter(
            workspace_id=workspace_id,
            user=request.user,
            role=WorkspaceMember.ROLE_OWNER,
        ).exists():
            return True
        try:
            from apps.billing.models import Subscription
            sub = Subscription.objects.filter(user=request.user, is_active=True).first()
            if sub and sub.plan != Subscription.PLAN_FREE:
                return True
        except Exception:
            pass
        return False

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return is_workspace_member(request.user, obj.workspace_id)
        return is_manager_for_contact(request.user, obj)
