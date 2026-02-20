"""
Views for analytics app.
"""
import csv
import io
from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Avg, Sum, Q, F
from django.core.cache import cache
from datetime import timedelta, datetime
from apps.todo.models import Project, WorkItem
from apps.core.models import User, WorkspaceMember
from apps.auth.permissions import IsWorkspaceMember
from apps.calendar.models import CalendarEvent
from apps.timetracking.models import TimeLog


class AnalyticsViewSet(viewsets.ViewSet):
    """
    ViewSet для аналитики и метрик.
    """
    permission_classes = [IsWorkspaceMember]
    
    @action(detail=False, methods=['get'], url_path='dashboard/overview')
    def overview(self, request):
        """
        GET /api/v1/analytics/dashboard/overview/
        Сводка главного дашборда: задачи на сегодня, встречи, бюджет, активный таймер.
        """
        user = request.user
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        # Проекты пользователя (через workspace)
        workspace_ids = WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        user_projects = Project.objects.filter(workspace_id__in=workspace_ids)
        active_projects_count = user_projects.filter(status=Project.STATUS_ACTIVE).count()
        
        # Сумма потраченного бюджета по всем активным проектам
        budget_agg = user_projects.filter(status=Project.STATUS_ACTIVE).aggregate(
            total=Sum('budget_spent')
        )
        total_budget_spent = budget_agg['total'] or Decimal('0')
        
        # Задачи текущего пользователя (назначенные на него, не завершённые/отменённые)
        my_tasks = WorkItem.objects.filter(
            assigned_to=user,
            deleted_at__isnull=True
        ).exclude(status__in=[WorkItem.STATUS_COMPLETED, WorkItem.STATUS_CANCELLED])
        tasks_count = my_tasks.count()
        
        # Задачи на сегодня (с дедлайном сегодня)
        today_date = timezone.now().date()
        tasks_today = my_tasks.filter(due_date=today_date).count()
        
        # События календаря на сегодня (владелец или участник)
        today_events = CalendarEvent.objects.filter(
            Q(owner=user) | Q(attendees=user),
            start_date__gte=today_start,
            start_date__lt=today_end
        ).distinct()
        today_events_count = today_events.count()
        
        # Часы за сегодня (из TimeLog)
        day_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        hours_today_agg = TimeLog.objects.filter(
            user=user,
            started_at__gte=day_start,
            stopped_at__isnull=False
        ).aggregate(total=Sum('duration_minutes'))
        hours_today_minutes = hours_today_agg['total'] or 0
        hours_today = round(hours_today_minutes / 60, 1)
        
        # Недавние задачи (топ-5 для дашборда)
        recent_tasks_qs = my_tasks.select_related('project').order_by('-updated_at')[:5]
        recent_tasks = [
            {
                'id': t.id,
                'title': t.title,
                'status': t.status,
                'priority': t.priority,
                'due_date': t.due_date.isoformat() if t.due_date else None,
                'project_id': t.project_id,
                'project_name': t.project.name if t.project else None,
            }
            for t in recent_tasks_qs
        ]
        
        # Активный таймер
        active_timer = TimeLog.objects.filter(
            user=user,
            stopped_at__isnull=True
        ).select_related('workitem').first()
        active_timer_data = None
        if active_timer:
            elapsed = (timezone.now() - active_timer.started_at).total_seconds()
            active_timer_data = {
                'id': active_timer.id,
                'workitem_id': active_timer.workitem_id,
                'workitem_title': active_timer.workitem.title if active_timer.workitem else '',
                'started_at': active_timer.started_at.isoformat(),
                'elapsed_seconds': int(elapsed),
            }
        
        data = {
            'tasks_count': tasks_count,
            'tasks_today': tasks_today,
            'active_projects_count': active_projects_count,
            'total_budget_spent': str(total_budget_spent),
            'today_events_count': today_events_count,
            'hours_today': hours_today,
            'recent_tasks': recent_tasks,
            'active_timer': active_timer_data,
        }
        return Response(data)
    
    @action(detail=False, methods=['get'], url_path='dashboard-stats/(?P<workspace_id>[^/.]+)')
    def dashboard_stats(self, request, workspace_id=None):
        """
        Общая статистика для дашборда workspace.
        """
        cache_key = f'dashboard_stats_{workspace_id}'
        cached_data = cache.get(cache_key)
        
        if cached_data:
            return Response(cached_data)
        
        # Получаем проекты workspace
        projects = Project.objects.filter(workspace_id=workspace_id)
        
        # Статистика по задачам
        tasks = WorkItem.objects.filter(
            project__workspace_id=workspace_id,
            deleted_at__isnull=True
        )
        
        total_tasks = tasks.count()
        completed_tasks = tasks.filter(status=WorkItem.STATUS_COMPLETED).count()
        in_progress_tasks = tasks.filter(status=WorkItem.STATUS_IN_PROGRESS).count()
        overdue_tasks = tasks.filter(
            due_date__lt=timezone.now().date(),
            status__in=[WorkItem.STATUS_TODO, WorkItem.STATUS_IN_PROGRESS, WorkItem.STATUS_REVIEW]
        ).count()
        
        # Статистика по проектам
        active_projects = projects.filter(status=Project.STATUS_ACTIVE).count()
        completed_projects = projects.filter(status=Project.STATUS_COMPLETED).count()
        
        data = {
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'in_progress_tasks': in_progress_tasks,
            'overdue_tasks': overdue_tasks,
            'active_projects': active_projects,
            'completed_projects': completed_projects,
            'completion_rate': (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0,
        }
        
        # Кэшируем на 5 минут
        cache.set(cache_key, data, 300)
        
        return Response(data)
    
    @action(detail=False, methods=['get'], url_path='project-metrics/(?P<project_id>[^/.]+)')
    def project_metrics(self, request, project_id=None):
        """
        Метрики проекта.
        """
        cache_key = f'project_metrics_{project_id}'
        cached_data = cache.get(cache_key)
        
        if cached_data:
            return Response(cached_data)
        
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        tasks = WorkItem.objects.filter(
            project_id=project_id,
            deleted_at__isnull=True
        )
        
        # Lead Time (время от создания до завершения)
        completed_tasks = tasks.filter(
            status=WorkItem.STATUS_COMPLETED,
            completed_at__isnull=False
        )
        
        if completed_tasks.exists():
            lead_times = []
            for task in completed_tasks:
                if task.completed_at and task.created_at:
                    lead_time = (task.completed_at - task.created_at).total_seconds() / 86400  # дни
                    lead_times.append(lead_time)
            
            avg_lead_time = sum(lead_times) / len(lead_times) if lead_times else 0
        else:
            avg_lead_time = 0
        
        # Cycle Time (время в активной работе)
        # Упрощённая версия: время от in_progress до completed
        cycle_times = []
        for task in completed_tasks:
            # Здесь можно добавить логику отслеживания времени в статусе in_progress
            # Пока используем упрощённую версию
            pass
        
        # Throughput (количество завершённых задач за период)
        last_30_days = timezone.now() - timedelta(days=30)
        throughput = completed_tasks.filter(completed_at__gte=last_30_days).count()
        
        # WIP (Work In Progress)
        wip = tasks.filter(
            status__in=[WorkItem.STATUS_IN_PROGRESS, WorkItem.STATUS_REVIEW]
        ).count()
        
        # Прогресс проекта
        total_tasks = tasks.count()
        completed_count = completed_tasks.count()
        progress = (completed_count / total_tasks * 100) if total_tasks > 0 else 0
        
        data = {
            'project_id': project.id,
            'project_name': project.name,
            'avg_lead_time_days': round(avg_lead_time, 2),
            'throughput_30_days': throughput,
            'wip': wip,
            'total_tasks': total_tasks,
            'completed_tasks': completed_count,
            'progress_percent': round(progress, 2),
        }
        
        # Кэшируем на 5 минут
        cache.set(cache_key, data, 300)
        
        return Response(data)
    
    @action(detail=False, methods=['get'], url_path='user-workload/(?P<user_id>[^/.]+)')
    def user_workload(self, request, user_id=None):
        """
        Загрузка пользователя.
        """
        cache_key = f'user_workload_{user_id}'
        cached_data = cache.get(cache_key)
        
        if cached_data:
            return Response(cached_data)
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Задачи пользователя
        assigned_tasks = WorkItem.objects.filter(
            assigned_to=user,
            deleted_at__isnull=True
        )
        
        total_tasks = assigned_tasks.count()
        in_progress = assigned_tasks.filter(status=WorkItem.STATUS_IN_PROGRESS).count()
        todo = assigned_tasks.filter(status=WorkItem.STATUS_TODO).count()
        completed = assigned_tasks.filter(status=WorkItem.STATUS_COMPLETED).count()
        overdue = assigned_tasks.filter(
            due_date__lt=timezone.now().date(),
            status__in=[WorkItem.STATUS_TODO, WorkItem.STATUS_IN_PROGRESS, WorkItem.STATUS_REVIEW]
        ).count()
        
        # Оценка времени
        total_estimated_hours = assigned_tasks.aggregate(
            total=Sum('estimated_hours')
        )['total'] or 0
        
        total_actual_hours = assigned_tasks.aggregate(
            total=Sum('actual_hours')
        )['total'] or 0
        
        data = {
            'user_id': user.id,
            'username': user.username,
            'total_tasks': total_tasks,
            'in_progress': in_progress,
            'todo': todo,
            'completed': completed,
            'overdue': overdue,
            'total_estimated_hours': float(total_estimated_hours),
            'total_actual_hours': float(total_actual_hours),
        }
        
        # Кэшируем на 5 минут
        cache.set(cache_key, data, 300)
        
        return Response(data)
    
    @action(detail=False, methods=['get'], url_path='export/tasks')
    def export_tasks(self, request):
        """
        Экспорт задач в CSV.
        GET /api/v1/analytics/export/tasks/?workspace_id=1 или ?project_id=1
        """
        workspace_id = request.query_params.get('workspace_id')
        project_id = request.query_params.get('project_id')
        if not workspace_id and not project_id:
            return Response(
                {'error': 'Укажите workspace_id или project_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            workspace_id = int(workspace_id) if workspace_id else None
            project_id = int(project_id) if project_id else None
        except (TypeError, ValueError):
            return Response(
                {'error': 'workspace_id и project_id должны быть числами'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if workspace_id and not WorkspaceMember.objects.filter(
            workspace_id=workspace_id, user=request.user
        ).exists():
            return Response(
                {'error': 'Нет доступа к этому пространству'},
                status=status.HTTP_403_FORBIDDEN
            )
        qs = WorkItem.objects.filter(deleted_at__isnull=True).select_related(
            'project', 'created_by'
        ).prefetch_related('assigned_to')
        if project_id:
            qs = qs.filter(project_id=project_id)
            proj = Project.objects.filter(pk=project_id).first()
            if proj and not WorkspaceMember.objects.filter(
                workspace_id=proj.workspace_id, user=request.user
            ).exists():
                return Response(
                    {'error': 'Нет доступа к этому проекту'},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            qs = qs.filter(project__workspace_id=workspace_id)
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            'ID', 'Название', 'Описание', 'Статус', 'Приоритет', 'Проект',
            'Дедлайн', 'Начало', 'Завершено', 'Прогресс %', 'Оценка ч', 'Факт ч',
            'Исполнители', 'Создан', 'Обновлён'
        ])
        for t in qs.order_by('-created_at'):
            assignees = ', '.join(u.username for u in t.assigned_to.all()) or '—'
            writer.writerow([
                t.id,
                (t.title or '')[:500],
                (t.description or '')[:1000],
                t.status,
                t.priority,
                t.project.name if t.project else '—',
                t.due_date.isoformat() if t.due_date else '—',
                t.start_date.isoformat() if t.start_date else '—',
                t.completed_at.strftime('%Y-%m-%d %H:%M') if t.completed_at else '—',
                t.progress or 0,
                t.estimated_hours or '—',
                t.actual_hours or '—',
                assignees,
                t.created_at.strftime('%Y-%m-%d %H:%M') if t.created_at else '—',
                t.updated_at.strftime('%Y-%m-%d %H:%M') if t.updated_at else '—',
            ])
        csv_content = '\ufeff' + buf.getvalue()
        filename = f'tasks_{project_id or workspace_id}_{timezone.now().strftime("%Y%m%d_%H%M")}.csv'
        response = Response(
            csv_content,
            content_type='text/csv; charset=utf-8',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'}
        )
        return response
    
    @action(detail=False, methods=['get'], url_path='export/projects')
    def export_projects(self, request):
        """
        Экспорт проектов в CSV.
        GET /api/v1/analytics/export/projects/?workspace_id=1
        """
        workspace_id = request.query_params.get('workspace_id')
        if not workspace_id:
            return Response(
                {'error': 'Укажите workspace_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            workspace_id = int(workspace_id)
        except (TypeError, ValueError):
            return Response(
                {'error': 'workspace_id должен быть числом'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not WorkspaceMember.objects.filter(
            workspace_id=workspace_id, user=request.user
        ).exists():
            return Response(
                {'error': 'Нет доступа к этому пространству'},
                status=status.HTTP_403_FORBIDDEN
            )
        qs = Project.objects.filter(workspace_id=workspace_id).select_related(
            'owner'
        ).order_by('-created_at')
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            'ID', 'Название', 'Описание', 'Статус', 'Владелец',
            'Дата начала', 'Дата окончания', 'Бюджет', 'Создан', 'Обновлён'
        ])
        for p in qs:
            writer.writerow([
                p.id,
                (p.name or '')[:500],
                (p.description or '')[:500],
                p.status,
                p.owner.username if p.owner else '—',
                p.start_date.isoformat() if p.start_date else '—',
                p.end_date.isoformat() if p.end_date else '—',
                str(p.budget) if p.budget is not None else '—',
                p.created_at.strftime('%Y-%m-%d %H:%M') if p.created_at else '—',
                p.updated_at.strftime('%Y-%m-%d %H:%M') if p.updated_at else '—',
            ])
        csv_content = '\ufeff' + buf.getvalue()
        filename = f'projects_{workspace_id}_{timezone.now().strftime("%Y%m%d_%H%M")}.csv'
        response = Response(
            csv_content,
            content_type='text/csv; charset=utf-8',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'}
        )
        return response