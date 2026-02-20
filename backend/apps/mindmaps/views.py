"""
Views for Mind Maps API.
"""
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework import filters
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.models import WorkspaceMember
from .models import MindMap
from .serializers import MindMapSerializer
from .permissions import CanAccessMindMap


class MindMapViewSet(viewsets.ModelViewSet):
    """
    CRUD для ментальных карт. Фильтры: project_id, related_workitem_id, workspace_id.
    """
    serializer_class = MindMapSerializer
    permission_classes = [CanAccessMindMap]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['project', 'related_workitem', 'workspace', 'is_personal']
    ordering_fields = ['created_at', 'updated_at', 'title']
    ordering = ['-updated_at']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return MindMap.objects.none()
        qs = MindMap.objects.select_related('owner', 'workspace', 'project', 'related_workitem')
        # Личные — только свои
        personal = Q(owner=user, is_personal=True)
        # Привязанные к workspace — участник пространства
        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        )
        by_workspace = Q(workspace_id__in=workspace_ids, is_personal=False)
        by_project_workspace = Q(project__workspace_id__in=workspace_ids, is_personal=False)
        by_workitem_workspace = Q(related_workitem__project__workspace_id__in=workspace_ids, is_personal=False)
        return qs.filter(
            personal | by_workspace | by_project_workspace | by_workitem_workspace
        ).distinct()
