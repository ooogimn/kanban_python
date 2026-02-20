"""
Views for schedule app — Production-grade API с изоляцией по workspace.
"""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter

from .models import Resource, ScheduleEntry
from .serializers import ResourceSerializer, ScheduleEntrySerializer
from apps.core.models import WorkspaceMember


class ResourceViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления ресурсами расписания.
    
    Изоляция: пользователь видит только ресурсы своих воркспейсов.
    """
    queryset = Resource.objects.none()
    serializer_class = ResourceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['workspace']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        """Фильтрация по воркспейсам пользователя."""
        user = self.request.user
        if not user or not user.is_authenticated:
            return Resource.objects.none()
        
        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list(
                'workspace_id', flat=True
            )
        )
        
        # Опционально: фильтр по активному workspace_id из query params
        active_workspace_id = self.request.query_params.get('workspace_id')
        if active_workspace_id:
            try:
                active_workspace_id = int(active_workspace_id)
                if active_workspace_id in workspace_ids:
                    workspace_ids = [active_workspace_id]
                else:
                    return Resource.objects.none()
            except (ValueError, TypeError):
                pass
        
        return (
            Resource.objects.filter(workspace_id__in=workspace_ids)
            .select_related('workspace')
            .order_by('name')
        )
    
    def perform_create(self, serializer):
        """При создании ресурса проверяем доступ к workspace."""
        workspace = serializer.validated_data.get('workspace')
        if workspace:
            # Проверка, что пользователь в этом workspace
            if not WorkspaceMember.objects.filter(
                workspace=workspace, user=self.request.user
            ).exists():
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied(
                    "У вас нет доступа к этому workspace."
                )
        serializer.save()


class ScheduleEntryViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления записями расписания.
    
    Изоляция: пользователь видит только записи ресурсов своих воркспейсов.
    Performance: select_related для предотвращения N+1.
    Filtering: по resource, start_time (gte/lte) — критично для календаря.
    """
    queryset = ScheduleEntry.objects.none()
    serializer_class = ScheduleEntrySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {
        'resource': ['exact'],
        'start_time': ['gte', 'lte'],
        'end_time': ['gte', 'lte'],
    }
    ordering_fields = ['start_time', 'end_time']
    ordering = ['start_time']
    
    def get_queryset(self):
        """
        Фильтрация по воркспейсам пользователя через ресурс.
        
        Performance: select_related('resource', 'related_workitem') решает N+1.
        """
        user = self.request.user
        if not user or not user.is_authenticated:
            return ScheduleEntry.objects.none()
        
        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list(
                'workspace_id', flat=True
            )
        )
        
        # Опционально: фильтр по активному workspace_id
        active_workspace_id = self.request.query_params.get('workspace_id')
        if active_workspace_id:
            try:
                active_workspace_id = int(active_workspace_id)
                if active_workspace_id in workspace_ids:
                    workspace_ids = [active_workspace_id]
                else:
                    return ScheduleEntry.objects.none()
            except (ValueError, TypeError):
                pass
        
        return (
            ScheduleEntry.objects.filter(
                resource__workspace_id__in=workspace_ids
            )
            .select_related('resource', 'resource__workspace', 'related_workitem')
            .order_by('start_time')
        )
    
    def perform_create(self, serializer):
        """При создании записи проверяем доступ к ресурсу."""
        resource = serializer.validated_data.get('resource')
        if resource:
            # Проверка, что пользователь в workspace ресурса
            if not WorkspaceMember.objects.filter(
                workspace=resource.workspace, user=self.request.user
            ).exists():
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied(
                    "У вас нет доступа к этому ресурсу."
                )
        serializer.save()
