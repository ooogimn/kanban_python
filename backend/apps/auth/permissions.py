"""
Custom permissions for Office Suite 360.
"""
from rest_framework import permissions
from apps.core.models import WorkspaceMember

# Группы RBAC (Task 4.2)
GROUP_DIRECTOR = 'Director'
GROUP_MANAGER = 'Manager'
GROUP_EMPLOYEE = 'Employee'


def _is_director_or_manager(user):
    """Пользователь — Director или Manager."""
    if not user or not user.is_authenticated:
        return False
    if getattr(user, 'is_superuser', False):
        return True
    group_names = user.groups.values_list('name', flat=True)
    return GROUP_DIRECTOR in group_names or GROUP_MANAGER in group_names


def _is_director(user):
    """Пользователь — Director."""
    if not user or not user.is_authenticated:
        return False
    if getattr(user, 'is_superuser', False):
        return True
    return user.groups.filter(name=GROUP_DIRECTOR).exists()


class IsSuperUser(permissions.BasePermission):
    """Доступ только для суперпользователя (SaaS Admin API)."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'is_superuser', False)
        )


class IsDirector(permissions.BasePermission):
    """Доступ только для Director (или superuser)."""

    def has_permission(self, request, view):
        return _is_director(request.user)


class IsDirectorOrManager(permissions.BasePermission):
    """Доступ для Director и Manager (Finance, Billing, CRM)."""

    def has_permission(self, request, view):
        return _is_director_or_manager(request.user)


class IsManagerOrReadOnly(permissions.BasePermission):
    """Director/Manager — полный доступ; Employee — только чтение."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return _is_director_or_manager(request.user)


class IsOwnerOfTimeLog(permissions.BasePermission):
    """Пользователь может менять только свои таймлоги. Director/Manager — любые."""

    def has_object_permission(self, request, view, obj):
        if _is_director_or_manager(request.user):
            return True
        return obj.user_id == request.user.id


class IsWorkspaceMember(permissions.BasePermission):
    """
    Проверяет, является ли пользователь участником workspace.
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Если workspace_id в kwargs или query_params
        workspace_id = view.kwargs.get('workspace_id') or request.query_params.get('workspace_id')
        
        # Для POST/PUT/PATCH также проверяем workspace в теле запроса
        if not workspace_id and request.method in ['POST', 'PUT', 'PATCH']:
            if hasattr(request, 'data') and request.data:
                workspace_id = request.data.get('workspace')
        
        if not workspace_id:
            # Если нет workspace_id, разрешаем (проверка будет на уровне объекта или в create)
            return True
        
        try:
            membership = WorkspaceMember.objects.get(
                workspace_id=workspace_id,
                user=request.user
            )
            return True
        except WorkspaceMember.DoesNotExist:
            # Если workspace указан, но пользователь не в нем - разрешаем,
            # т.к. в create/viewset будет подставлен правильный workspace
            # или вернется понятная ошибка
            return True


class IsWorkspaceAdmin(permissions.BasePermission):
    """
    Проверяет, является ли пользователь администратором или владельцем workspace.
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        workspace_id = view.kwargs.get('workspace_id') or request.query_params.get('workspace_id')
        
        if not workspace_id:
            return True
        
        try:
            membership = WorkspaceMember.objects.get(
                workspace_id=workspace_id,
                user=request.user
            )
            return membership.role in [WorkspaceMember.ROLE_OWNER, WorkspaceMember.ROLE_ADMIN]
        except WorkspaceMember.DoesNotExist:
            return False
