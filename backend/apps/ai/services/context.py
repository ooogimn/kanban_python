"""
AI-SPRINT 1: контекст проекта для LLM.
Согласовано с логикой приоритета/статуса WorkItem (high/urgent = горящие; completed/cancelled = не горящие).
"""
from datetime import date
from django.db.models import Q

from apps.auth.permissions import _is_director_or_manager
from apps.todo.models import Project, WorkItem
from apps.core.models import ProjectMember
from apps.notifications.models import AuditLog


class ProjectContextService:
    """Сбор снимка проекта для AI (саммари, контекст)."""

    NOT_DONE_STATUSES = (WorkItem.STATUS_TODO, WorkItem.STATUS_IN_PROGRESS, WorkItem.STATUS_REVIEW)
    HOT_PRIORITIES = (WorkItem.PRIORITY_HIGH, WorkItem.PRIORITY_URGENT)
    RECENT_ACTIVITY_LIMIT = 5

    @classmethod
    def get_project_summary(cls, project_id: int, user):
        """
        Агрегирует данные по проекту для LLM.
        Финансы включаются только при правах Director/Manager.
        """
        project = Project.objects.filter(id=project_id).select_related('workspace').first()
        if not project:
            return None

        # Meta
        meta = {
            'name': project.name,
            'description': (project.description or '')[:500],
            'health_status': getattr(project, 'health_status', 'on_track') or 'on_track',
            'progress': getattr(project, 'progress', 0) or 0,
            'status': project.status,
        }

        # Team
        members = list(
            ProjectMember.objects.filter(project_id=project_id)
            .select_related('project')
            .values_list('display_name', 'role')
        )
        team = [{'name': name, 'role': role or 'Member'} for name, role in members]

        # Tasks: всего, завершено, горящие (high/urgent + не completed/cancelled), просроченные
        tasks_qs = WorkItem.objects.filter(project_id=project_id)
        total_tasks = tasks_qs.count()
        completed_count = tasks_qs.filter(status=WorkItem.STATUS_COMPLETED).count()
        hot_qs = tasks_qs.filter(
            priority__in=cls.HOT_PRIORITIES,
        ).exclude(status__in=(WorkItem.STATUS_COMPLETED, WorkItem.STATUS_CANCELLED))
        hot_count = hot_qs.count()
        hot_list = list(
            hot_qs.order_by('-due_date').values('id', 'title', 'priority', 'status', 'due_date')[:5]
        )
        today = date.today()
        overdue_count = tasks_qs.filter(
            due_date__lt=today,
        ).exclude(status__in=(WorkItem.STATUS_COMPLETED, WorkItem.STATUS_CANCELLED)).count()

        tasks_stats = {
            'total': total_tasks,
            'completed': completed_count,
            'hot_count': hot_count,
            'hot_tasks': hot_list,
            'overdue_count': overdue_count,
        }

        # Finance (только при правах)
        finance = None
        if user and _is_director_or_manager(user):
            from apps.finance.services import FinanceService
            balance = FinanceService.get_project_balance(project_id)
            finance = {
                'budget': str(balance['total_budget']),
                'spent': str(balance['spent']),
                'available': str(balance['available']),
                'status': 'deficit' if balance['available'] < 0 else 'ok',
            }

        # Recent Activity (AuditLog по проекту и задачам)
        task_ids = list(WorkItem.objects.filter(project_id=project_id).values_list('id', flat=True))
        activity_qs = AuditLog.objects.filter(
            Q(model_name='project', object_id=project_id)
            | Q(model_name='workitem', object_id__in=task_ids)
        ).select_related('user').order_by('-timestamp')[:cls.RECENT_ACTIVITY_LIMIT]
        recent_activity = [
            {
                'action': a.action,
                'model': a.model_name,
                'object_id': a.object_id,
                'user': a.user.get_full_name() or getattr(a.user, 'username', '') if a.user else '',
                'timestamp': a.timestamp.isoformat(),
            }
            for a in activity_qs
        ]

        return {
            'meta': meta,
            'team': team,
            'tasks_stats': tasks_stats,
            'finance': finance,
            'recent_activity': recent_activity,
        }
