"""
Views for timetracking app.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from apps.auth.permissions import _is_director_or_manager, IsOwnerOfTimeLog
from apps.core.models import WorkspaceMember
from django.db.models import Sum
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter

from .models import TimeLog
from .serializers import (
    TimeLogSerializer,
    TimeLogCreateSerializer,
    StartTimerSerializer,
    StopTimerSerializer,
)
from apps.todo.models import WorkItem


class TimeLogViewSet(viewsets.ModelViewSet):
    """
    ViewSet для учета времени.
    
    GET /timetracking/logs/ — список записей
    GET /timetracking/logs/{id}/ — детали записи
    POST /timetracking/logs/ — создать запись
    DELETE /timetracking/logs/{id}/ — удалить запись
    
    POST /timetracking/logs/start/ — запустить таймер
    POST /timetracking/logs/stop/ — остановить таймер
    GET /timetracking/logs/active/ — получить активный таймер
    GET /timetracking/logs/active_for_task/?workitem_id=X — активный таймер для задачи
    """
    
    permission_classes = [IsAuthenticated, IsOwnerOfTimeLog]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['workitem', 'user', 'billable']
    ordering_fields = ['started_at', 'stopped_at', 'duration_minutes']
    ordering = ['-started_at']
    
    def get_queryset(self):
        """
        Employee: только свои логи.
        Director/Manager: все логи в проектах их workspace.
        """
        user = self.request.user
        if _is_director_or_manager(user):
            workspace_ids = WorkspaceMember.objects.filter(
                user=user
            ).values_list('workspace_id', flat=True)
            return TimeLog.objects.filter(
                workitem__project__workspace_id__in=workspace_ids
            ).select_related('workitem', 'user')
        return TimeLog.objects.filter(
            user=user
        ).select_related('workitem', 'user')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TimeLogCreateSerializer
        if self.action == 'start':
            return StartTimerSerializer
        if self.action == 'stop':
            return StopTimerSerializer
        return TimeLogSerializer
    
    @action(detail=False, methods=['post'])
    def start(self, request):
        """
        POST /timetracking/logs/start/
        Body: { "workitem_id": 123, "description": "", "billable": true }
        
        Запускает таймер для задачи.
        Если у пользователя уже есть запущенный таймер — останавливает его.
        """
        serializer = StartTimerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        workitem_id = serializer.validated_data['workitem_id']
        description = serializer.validated_data.get('description', '')
        billable = serializer.validated_data.get('billable', True)
        
        # Проверяем существование задачи
        try:
            workitem = WorkItem.objects.get(pk=workitem_id)
        except WorkItem.DoesNotExist:
            return Response(
                {'error': 'Задача не найдена'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Останавливаем активный таймер, если есть
        active_timer = TimeLog.objects.filter(
            user=request.user,
            stopped_at__isnull=True
        ).first()
        
        if active_timer:
            self._stop_timer(active_timer)
        
        # Создаем новый таймер
        new_timer = TimeLog.objects.create(
            workitem=workitem,
            user=request.user,
            started_at=timezone.now(),
            description=description,
            billable=billable,
        )
        
        return Response(
            TimeLogSerializer(new_timer).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=False, methods=['post'])
    def stop(self, request):
        """
        POST /timetracking/logs/stop/
        Body: { "description": "optional update" }
        
        Останавливает активный таймер пользователя.
        """
        active_timer = TimeLog.objects.filter(
            user=request.user,
            stopped_at__isnull=True
        ).first()
        
        if not active_timer:
            return Response(
                {'error': 'Нет активного таймера'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Обновляем описание, если передано
        serializer = StopTimerSerializer(data=request.data)
        if serializer.is_valid():
            description = serializer.validated_data.get('description')
            if description is not None:
                active_timer.description = description
        
        self._stop_timer(active_timer)
        
        return Response(TimeLogSerializer(active_timer).data)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """
        GET /timetracking/logs/active/
        
        Возвращает активный таймер пользователя (если есть).
        """
        active_timer = TimeLog.objects.filter(
            user=request.user,
            stopped_at__isnull=True
        ).select_related('workitem', 'user').first()
        
        if not active_timer:
            return Response({'active': None})
        
        return Response({
            'active': TimeLogSerializer(active_timer).data
        })
    
    @action(detail=False, methods=['get'])
    def active_for_task(self, request):
        """
        GET /timetracking/logs/active_for_task/?workitem_id=123
        
        Проверяет, есть ли активный таймер для конкретной задачи.
        """
        workitem_id = request.query_params.get('workitem_id')
        if not workitem_id:
            return Response(
                {'error': 'workitem_id обязателен'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        active_timer = TimeLog.objects.filter(
            user=request.user,
            workitem_id=workitem_id,
            stopped_at__isnull=True
        ).select_related('workitem', 'user').first()
        
        if not active_timer:
            return Response({'active': None, 'is_running': False})
        
        return Response({
            'active': TimeLogSerializer(active_timer).data,
            'is_running': True
        })
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        GET /timetracking/logs/summary/?workitem_id=123
        
        Возвращает суммарное время по задаче.
        """
        workitem_id = request.query_params.get('workitem_id')
        
        queryset = TimeLog.objects.filter(user=request.user)
        if workitem_id:
            queryset = queryset.filter(workitem_id=workitem_id)
        
        total_minutes = queryset.filter(
            stopped_at__isnull=False
        ).aggregate(total=Sum('duration_minutes'))['total'] or 0
        
        logs_count = queryset.count()
        
        return Response({
            'total_minutes': total_minutes,
            'total_hours': round(total_minutes / 60, 1),
            'logs_count': logs_count,
        })
    
    def _stop_timer(self, timer: TimeLog):
        """Вспомогательный метод для остановки таймера."""
        timer.stopped_at = timezone.now()
        delta = timer.stopped_at - timer.started_at
        timer.duration_minutes = int(delta.total_seconds() / 60)
        timer.save(update_fields=['stopped_at', 'duration_minutes', 'description'])
        
        # Обновляем actual_hours в задаче
        self._update_task_hours(timer.workitem)
    
    def _update_task_hours(self, workitem: WorkItem):
        """Обновляет actual_hours в задаче на основе всех логов."""
        total_minutes = TimeLog.objects.filter(
            workitem=workitem,
            stopped_at__isnull=False
        ).aggregate(total=Sum('duration_minutes'))['total'] or 0
        
        workitem.actual_hours = round(total_minutes / 60, 2)
        workitem._skip_signal = True
        workitem.save(update_fields=['actual_hours'])
