"""
Views для приложения notifications.
"""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.shortcuts import get_object_or_404

from .models import AuditLog
from .serializers import AuditLogSerializer
from apps.core.models import WorkspaceMember
from apps.todo.models import Project, WorkItem


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Журнал активности (Audit Log). Только чтение.
    Поддерживает фильтр по project_id: ?project_id=1 — записи по проекту и его задачам.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'head', 'options']

    def get_queryset(self):
        qs = AuditLog.objects.all().select_related('user').order_by('-timestamp')
        project_id = self.request.query_params.get('project_id')
        workitem_id = self.request.query_params.get('workitem_id')
        if workitem_id:
            try:
                workitem_id = int(workitem_id)
            except (TypeError, ValueError):
                return qs.none()
            task = get_object_or_404(WorkItem, id=workitem_id)
            if not WorkspaceMember.objects.filter(
                workspace_id=task.project.workspace_id,
                user=self.request.user
            ).exists():
                return qs.none()
            return qs.filter(model_name='workitem', object_id=workitem_id)
        if not project_id:
            # Для дашборда: последние N записей по всем проектам пользователя
            limit = self.request.query_params.get('limit', '20')
            try:
                limit = min(int(limit), 50)
            except (TypeError, ValueError):
                limit = 20
            workspace_ids = list(
                WorkspaceMember.objects.filter(user=self.request.user).values_list('workspace_id', flat=True)
            )
            project_ids = list(Project.objects.filter(workspace_id__in=workspace_ids).values_list('id', flat=True))
            task_ids = list(WorkItem.objects.filter(project_id__in=project_ids).values_list('id', flat=True))
            qs = qs.filter(
                Q(model_name='project', object_id__in=project_ids)
                | Q(model_name='workitem', object_id__in=task_ids)
            )[:limit]
            return qs
        try:
            project_id = int(project_id)
        except (TypeError, ValueError):
            return qs.none()
        project = get_object_or_404(Project, id=project_id)
        if not WorkspaceMember.objects.filter(
            workspace_id=project.workspace_id,
            user=self.request.user
        ).exists():
            return qs.none()
        task_ids = list(
            WorkItem.objects.filter(project_id=project_id).values_list('id', flat=True)
        )
        qs = qs.filter(
            Q(model_name='project', object_id=project_id)
            | Q(model_name='workitem', object_id__in=task_ids)
        )
        return qs
