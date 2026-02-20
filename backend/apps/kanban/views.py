"""
Views for kanban app.
Канбан — представление WorkItem. Модель Card удалена.
"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.db.models import F
from .models import Stage, Board, Column
from .serializers import (
    BoardSerializer, BoardFullSerializer,
    KanbanColumnSerializer, KanbanBoardSerializer,
    WorkItemShortSerializer
)
from apps.auth.permissions import IsWorkspaceMember
from apps.core.models import WorkspaceMember
from apps.todo.models import WorkItem

logger = logging.getLogger(__name__)

# Маппинг column_type -> status для синхронизации при перемещении
COLUMN_TYPE_TO_STATUS = {
    Column.COLUMN_TYPE_TODO: WorkItem.STATUS_TODO,
    Column.COLUMN_TYPE_IN_PROGRESS: WorkItem.STATUS_IN_PROGRESS,
    Column.COLUMN_TYPE_REVIEW: WorkItem.STATUS_REVIEW,
    Column.COLUMN_TYPE_COMPLETED: WorkItem.STATUS_COMPLETED,
}


class BoardViewSet(viewsets.ModelViewSet):
    """ViewSet для управления этапами (Stage, ранее Board)."""

    queryset = Stage.objects.all()
    serializer_class = BoardSerializer
    permission_classes = [IsWorkspaceMember]

    def get_serializer_class(self):
        if self.action == 'kanban':
            return KanbanBoardSerializer
        if self.action == 'full':
            return BoardFullSerializer
        return BoardSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        # Доски только из workspace, где пользователь участник (или все для staff)
        if user and user.is_authenticated and not getattr(user, 'is_staff', False):
            workspace_ids = list(
                WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
            )
            if workspace_ids:
                queryset = queryset.filter(project__workspace_id__in=workspace_ids)
            else:
                queryset = queryset.none()
        project_id = self.request.query_params.get('project_id')
        workspace_id = self.request.query_params.get('workspace_id')
        if workspace_id:
            queryset = queryset.filter(project__workspace_id=workspace_id)
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset.select_related('project', 'project__workspace').prefetch_related(
            'columns__workitems_direct',
            'columns__workitems_direct__checklist_items',
        )

    @action(detail=True, methods=['get'], url_path='kanban')
    def kanban(self, request, pk=None):
        """Получение доски: колонки + WorkItem."""
        board = self.get_object()
        serializer = KanbanBoardSerializer(board, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def full(self, request, pk=None):
        """Получение доски со всеми колонками и WorkItem (items)."""
        board = self.get_object()
        serializer = BoardFullSerializer(board, context={'request': request})
        return Response(serializer.data)


class KanbanColumnViewSet(viewsets.ModelViewSet):
    """ViewSet для управления колонками канбана (CRUD + move_task). Системные колонки (plan/in_progress/done) удалять нельзя."""

    queryset = Column.objects.all()
    serializer_class = KanbanColumnSerializer
    permission_classes = [IsWorkspaceMember]

    def perform_destroy(self, instance):
        # Удалять можно только пользовательские колонки (system_type == 'other').
        # Три обязательные (plan, in_progress, done) — нельзя.
        if instance.system_type != Column.SYSTEM_TYPE_OTHER:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                'Системные колонки (В плане, В работе, Завершено) удалять нельзя.'
            )
        # Колонку нельзя удалить, пока в ней есть задачи.
        if instance.workitems_direct.filter(deleted_at__isnull=True).exists():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                'Колонку нельзя удалить, пока в ней есть задачи. Перенесите задачи в другие колонки.'
            )
        instance.delete()

    def get_queryset(self):
        queryset = super().get_queryset()
        board_id = self.request.query_params.get('board_id')
        stage_id = self.request.query_params.get('stage_id')
        project_id = self.request.query_params.get('project_id')
        sid = stage_id or board_id
        if sid:
            queryset = queryset.filter(stage_id=sid)
        if project_id:
            queryset = queryset.filter(stage__project_id=project_id)
        return queryset.select_related('stage', 'stage__project').prefetch_related(
            'workitems_direct'
        )

    @action(detail=False, methods=['post'], url_path='move-task')
    def move_task(self, request):
        """
        Drag-and-Drop: перемещение задачи между колонками.
        Параметры: workitem_id, target_column_id, new_order.
        Обновляет: workitem.kanban_column, workitem.sort_order, workitem.status (по column_type).
        """
        workitem_id = request.data.get('workitem_id')
        target_column_id = request.data.get('target_column_id')
        new_order = request.data.get('new_order', 0)

        if not workitem_id or not target_column_id:
            return Response(
                {'error': 'workitem_id и target_column_id обязательны'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            target_column = Column.objects.select_related('stage').get(id=target_column_id)
        except Column.DoesNotExist:
            return Response(
                {'error': 'Колонка не найдена'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            workitem = WorkItem.objects.select_related('kanban_column').get(
                id=workitem_id, deleted_at__isnull=True
            )
        except WorkItem.DoesNotExist:
            return Response(
                {'error': 'Задача не найдена'},
                status=status.HTTP_404_NOT_FOUND
            )

        with transaction.atomic():
            old_column = workitem.kanban_column
            old_position = workitem.sort_order
            same_column = old_column and old_column.id == target_column.id

            if same_column:
                # Перемещение внутри той же колонки
                if new_order > old_position:
                    WorkItem.objects.filter(
                        kanban_column=target_column,
                        sort_order__gt=old_position,
                        sort_order__lte=new_order,
                        deleted_at__isnull=True
                    ).exclude(id=workitem_id).update(sort_order=F('sort_order') - 1)
                elif new_order < old_position:
                    WorkItem.objects.filter(
                        kanban_column=target_column,
                        sort_order__gte=new_order,
                        sort_order__lt=old_position,
                        deleted_at__isnull=True
                    ).exclude(id=workitem_id).update(sort_order=F('sort_order') + 1)
            else:
                # Перемещение в другую колонку
                WorkItem.objects.filter(
                    kanban_column=target_column,
                    sort_order__gte=new_order,
                    deleted_at__isnull=True
                ).exclude(id=workitem_id).update(sort_order=F('sort_order') + 1)
                if old_column:
                    WorkItem.objects.filter(
                        kanban_column=old_column,
                        sort_order__gt=old_position,
                        deleted_at__isnull=True
                    ).update(sort_order=F('sort_order') - 1)

            # Обновляем WorkItem (спринт = доска колонки)
            workitem.kanban_column = target_column
            workitem.stage = target_column.stage
            workitem.sort_order = new_order

            # Синхронизация status по column_type
            from django.utils import timezone
            update_fields = ['kanban_column', 'stage', 'sort_order', 'status', 'updated_at']
            new_status = COLUMN_TYPE_TO_STATUS.get(target_column.column_type)
            if new_status and workitem.status != new_status:
                workitem.status = new_status
                if new_status == WorkItem.STATUS_IN_PROGRESS and not workitem.started_at:
                    workitem.started_at = timezone.now()
                    update_fields.append('started_at')
                if new_status == WorkItem.STATUS_COMPLETED:
                    if not workitem.completed_at:
                        from apps.todo.services.checklist_service import complete_checklist_for_workitem
                        complete_checklist_for_workitem(workitem)
                        workitem.completed_at = timezone.now()
                        workitem.progress = 100
                    update_fields.extend(['completed_at', 'progress'])

            workitem._skip_signal = True
            workitem.save(update_fields=update_fields)

        serializer = WorkItemShortSerializer(workitem, context={'request': request})
        return Response(serializer.data)
