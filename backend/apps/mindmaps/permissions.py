"""
Permissions for Mind Maps.
"""
from rest_framework import permissions
from apps.core.models import WorkspaceMember


class CanAccessMindMap(permissions.BasePermission):
    """
    is_personal=True -> только владелец.
    Иначе — участник workspace или проекта (по привязке).
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS and obj.owner_id == request.user.id:
            return True
        if obj.owner_id == request.user.id:
            return True
        if obj.is_personal:
            return False
        if obj.workspace_id:
            try:
                membership = WorkspaceMember.objects.get(workspace_id=obj.workspace_id, user=request.user)
                if request.method in permissions.SAFE_METHODS:
                    return True
                return membership.role != WorkspaceMember.ROLE_VIEWER
            except WorkspaceMember.DoesNotExist:
                pass
        if obj.project_id:
            try:
                membership = WorkspaceMember.objects.get(
                    workspace_id=obj.project.workspace_id,
                    user=request.user,
                )
                if request.method in permissions.SAFE_METHODS:
                    return True
                return membership.role != WorkspaceMember.ROLE_VIEWER
            except (WorkspaceMember.DoesNotExist, AttributeError):
                pass
        if obj.related_workitem_id:
            try:
                membership = WorkspaceMember.objects.get(
                    workspace_id=obj.related_workitem.project.workspace_id,
                    user=request.user,
                )
                if request.method in permissions.SAFE_METHODS:
                    return True
                return membership.role != WorkspaceMember.ROLE_VIEWER
            except (WorkspaceMember.DoesNotExist, AttributeError):
                pass
        return False
