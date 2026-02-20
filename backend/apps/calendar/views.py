"""
Views for calendar app. Calendar 2.0: feed = events + tasks (WorkItem) with due_date/start_date.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from datetime import datetime, time

from .models import CalendarEvent
from .serializers import CalendarEventSerializer
from apps.auth.permissions import IsWorkspaceMember
from apps.core.models import WorkspaceMember
from apps.todo.models import Project, WorkItem


class CalendarEventViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления событиями календаря.

    Изоляция по workspace: выдаются только события текущего активного
    воркспейса (related_workitem__project__workspace_id). Личные события
    без привязки к задаче (related_workitem is null) видны только автору.
    """
    queryset = CalendarEvent.objects.none()
    serializer_class = CalendarEventSerializer
    permission_classes = [IsWorkspaceMember]

    def get_queryset(self):
        """Фильтрация событий строго по текущему воркспейсу пользователя."""
        user = self.request.user
        if not user or not user.is_authenticated:
            return CalendarEvent.objects.none()

        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list(
                'workspace_id', flat=True
            )
        )
        active_workspace_id = self.request.query_params.get('workspace_id')
        if active_workspace_id:
            try:
                active_workspace_id = int(active_workspace_id)
            except (ValueError, TypeError):
                active_workspace_id = None
            if active_workspace_id and active_workspace_id not in workspace_ids:
                return CalendarEvent.objects.none()

        if active_workspace_id:
            workspace_filter = Q(
                related_workitem__project__workspace_id=active_workspace_id
            )
        else:
            workspace_filter = Q(
                related_workitem__project__workspace_id__in=workspace_ids
            )
        personal_filter = Q(
            related_workitem_id__isnull=True,
            owner=user
        )
        queryset = (
            CalendarEvent.objects.filter(workspace_filter | personal_filter)
            .select_related('owner', 'related_workitem', 'related_workitem__project')
            .prefetch_related('attendees')
        )

        # Фильтр по датам
        start = self.request.query_params.get('start')
        end = self.request.query_params.get('end')
        if start:
            try:
                start_date = datetime.fromisoformat(
                    start.replace('Z', '+00:00')
                )
                queryset = queryset.filter(start_date__gte=start_date)
            except (ValueError, AttributeError):
                pass
        if end:
            try:
                end_date = datetime.fromisoformat(end.replace('Z', '+00:00'))
                queryset = queryset.filter(end_date__lte=end_date)
            except (ValueError, AttributeError):
                pass

        # Фильтр по владельцу (доп. ограничение поверх workspace)
        owner = self.request.query_params.get('owner')
        if owner:
            queryset = queryset.filter(owner_id=owner)

        # Фильтр по связанной задаче
        related_workitem = self.request.query_params.get('related_workitem')
        if related_workitem:
            queryset = queryset.filter(related_workitem_id=related_workitem)

        # Фильтр по проекту (события, привязанные к задачам проекта)
        project_id = self.request.query_params.get('project')
        if project_id:
            try:
                queryset = queryset.filter(
                    related_workitem__project_id=int(project_id)
                )
            except (ValueError, TypeError):
                pass

        return queryset
    
    def perform_create(self, serializer):
        """Установка owner при создании."""
        serializer.save(owner=self.request.user)
    
    @action(detail=False, methods=['get'])
    def range(self, request):
        """
        Получение событий в диапазоне дат.
        
        Параметры:
        - start: начальная дата (ISO format)
        - end: конечная дата (ISO format)
        """
        start = request.query_params.get('start')
        end = request.query_params.get('end')
        
        if not start or not end:
            return Response(
                {'error': 'start and end parameters are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            start_date = datetime.fromisoformat(start.replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(end.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            return Response(
                {'error': 'Invalid date format. Use ISO format.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        events = self.get_queryset().filter(
            start_date__gte=start_date,
            end_date__lte=end_date
        )
        serializer = self.get_serializer(events, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='feed')
    def feed(self, request):
        """
        Calendar 2.0: объединённый список событий и задач (WorkItem) с датами в диапазоне.
        Параметры: start, end (ISO), workspace_id (опц.), project (опц.).
        """
        start = request.query_params.get('start')
        end = request.query_params.get('end')
        if not start or not end:
            return Response(
                {'error': 'start and end parameters are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            start_dt = datetime.fromisoformat(start.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            return Response(
                {'error': 'Invalid date format. Use ISO format.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = request.user
        if not user or not user.is_authenticated:
            return Response([], status=status.HTTP_200_OK)

        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        )
        active_workspace_id = request.query_params.get('workspace_id')
        if active_workspace_id:
            try:
                active_workspace_id = int(active_workspace_id)
                if active_workspace_id not in workspace_ids:
                    return Response([], status=status.HTTP_200_OK)
                workspace_ids = [active_workspace_id]
            except (ValueError, TypeError):
                return Response([], status=status.HTTP_200_OK)

        project_id_param = request.query_params.get('project')
        project_ids = list(Project.objects.filter(workspace_id__in=workspace_ids).values_list('id', flat=True))
        if project_id_param:
            try:
                pid = int(project_id_param)
                if pid in project_ids:
                    project_ids = [pid]
            except (ValueError, TypeError):
                pass

        out = []

        # 1. События в диапазоне
        events_qs = self.get_queryset().filter(
            start_date__gte=start_dt,
            end_date__lte=end_dt,
        )
        for e in events_qs:
            out.append({
                'id': f'event_{e.id}',
                'title': e.title,
                'start': e.start_date.isoformat() if e.start_date else None,
                'end': e.end_date.isoformat() if e.end_date else None,
                'color': e.color or '#3788d8',
                'is_task': False,
                'workitem_id': e.related_workitem_id,
                'event_id': e.id,
                'allDay': getattr(e, 'all_day', False),
            })

        # 2. Задачи с due_date или start_date в диапазоне
        start_date_only = start_dt.date() if hasattr(start_dt, 'date') else start_dt
        end_date_only = end_dt.date() if hasattr(end_dt, 'date') else end_dt
        tasks_qs = WorkItem.objects.filter(
            project_id__in=project_ids,
        ).filter(
            Q(due_date__gte=start_date_only, due_date__lte=end_date_only)
            | Q(start_date__gte=start_date_only, start_date__lte=end_date_only)
        ).select_related('project')
        for t in tasks_qs:
            date_use = t.due_date or t.start_date
            if not date_use:
                continue
            day_start = datetime.combine(date_use, time.min)
            day_end = datetime.combine(date_use, time.max)
            priority = t.priority or WorkItem.PRIORITY_MEDIUM
            if priority in (WorkItem.PRIORITY_HIGH, WorkItem.PRIORITY_URGENT):
                color = '#E53935'
            elif priority == WorkItem.PRIORITY_LOW:
                color = '#9E9E9E'
            elif t.status == WorkItem.STATUS_COMPLETED:
                color = '#43A047'
            else:
                color = '#1E88E5'
            out.append({
                'id': f'task_{t.id}',
                'title': t.title,
                'start': day_start.isoformat(),
                'end': day_end.isoformat(),
                'color': color,
                'is_task': True,
                'workitem_id': t.id,
                'event_id': None,
                'allDay': True,
            })

        out.sort(key=lambda x: (x['start'] or ''))
        return Response(out, status=status.HTTP_200_OK)
