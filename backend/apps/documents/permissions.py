"""
Permissions for documents app.
"""
from rest_framework import permissions
from apps.core.models import WorkspaceMember
from apps.todo.models import Project


class HasProjectAccess(permissions.BasePermission):
    """
    Проверяет доступ к проекту через WorkspaceMember.
    """
    
    def has_object_permission(self, request, view, obj):
        """Проверка доступа к объекту."""
        # Получаем project из объекта
        project = None
        
        if hasattr(obj, 'project'):
            project = obj.project
        elif hasattr(obj, 'workitem') and obj.workitem:
            project = obj.workitem.project
        elif hasattr(obj, 'content_object'):
            content_obj = obj.content_object
            if hasattr(content_obj, 'project'):
                project = content_obj.project
            elif hasattr(content_obj, 'workspace'):
                # Сущность — сам проект (Comment к проекту)
                project = content_obj
            elif hasattr(content_obj, 'related_workitem') and content_obj.related_workitem:
                if content_obj.related_workitem.project:
                    project = content_obj.related_workitem.project
        
        if not project:
            # Если project не найден, разрешаем (для обратной совместимости)
            return True
        
        # Проверяем доступ к workspace проекта
        try:
            WorkspaceMember.objects.get(
                workspace=project.workspace,
                user=request.user
            )
            return True
        except WorkspaceMember.DoesNotExist:
            return False


class CanEditComment(permissions.BasePermission):
    """
    Проверяет, может ли пользователь редактировать комментарий.
    Только автор может редактировать.
    """
    
    def has_object_permission(self, request, view, obj):
        """Проверка прав на редактирование."""
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Только автор может редактировать/удалять
        return obj.author == request.user


class CanEditWikiPage(permissions.BasePermission):
    """
    Проверяет, может ли пользователь редактировать Wiki страницу.
    Личная заметка (workspace is None) — только автор или суперпользователь.
    """

    def has_object_permission(self, request, view, obj):
        """Проверка прав на редактирование."""
        # Личная заметка: только автор или суперпользователь
        if obj.workspace_id is None:
            return obj.author_id == request.user.id or request.user.is_superuser

        if request.method in permissions.SAFE_METHODS:
            if obj.is_published:
                try:
                    WorkspaceMember.objects.get(
                        workspace=obj.workspace,
                        user=request.user
                    )
                    return True
                except WorkspaceMember.DoesNotExist:
                    return False
            else:
                try:
                    WorkspaceMember.objects.get(
                        workspace=obj.workspace,
                        user=request.user
                    )
                    return True
                except WorkspaceMember.DoesNotExist:
                    return False

        if obj.author == request.user:
            return True

        try:
            membership = WorkspaceMember.objects.get(
                workspace=obj.workspace,
                user=request.user
            )
            return membership.role in [WorkspaceMember.ROLE_OWNER, WorkspaceMember.ROLE_ADMIN]
        except WorkspaceMember.DoesNotExist:
            return False
