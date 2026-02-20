"""
Сервисы core — умные уведомления о бюджете по учёту времени (TimeLog),
пересчёт прогресса и здоровья Workspace (SPRINT 1).
Личное пространство и личный проект по умолчанию для personal-пользователей.
"""
import logging
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Avg

from apps.core.models import Workspace

logger = logging.getLogger(__name__)


def get_default_workspace_and_project(user):
    """
    Возвращает (workspace, project) для личного пространства и личного проекта пользователя.
    Используется при создании сущностей (wiki, задачи, доски и т.д.) для подстановки по умолчанию.
    Возвращает (None, None), если у пользователя нет личного пространства/проекта.
    """
    if not user or not user.pk:
        return None, None
    try:
        workspace = Workspace.objects.filter(owner=user, is_personal=True).first()
        if not workspace:
            return None, None
        from apps.todo.models import Project
        project = Project.objects.filter(workspace=workspace, is_personal=True).first()
        return workspace, project
    except Exception:
        return None, None


# --- Workspace Intelligence (SPRINT 1) ---

def recalculate_workspace_progress(workspace):
    """
    Пересчёт progress и health_status пространства по активным проектам.

    - Прогресс = среднее арифметическое progress всех неархивированных проектов.
    - Здоровье = 'behind', если более 20% проектов имеют health_status 'behind'.
    """
    if not workspace or not workspace.pk:
        return
    from apps.todo.models import Project
    from apps.core.models import Workspace as WorkspaceModel

    # Неархивированные проекты (активные для расчёта)
    projects = Project.objects.filter(
        workspace=workspace
    ).exclude(status=Project.STATUS_ARCHIVED)

    count = projects.count()
    if count == 0:
        workspace.progress = 0
        workspace.health_status = WorkspaceModel.HEALTH_ON_TRACK
        workspace.save(update_fields=['progress', 'health_status'])
        return

    agg = projects.aggregate(avg_progress=Avg('progress'))
    avg_progress = agg.get('avg_progress')
    if avg_progress is None:
        avg_progress = 0
    progress = min(100, max(0, int(round(avg_progress))))

    behind_count = projects.filter(health_status='behind').count()
    health_status = (
        WorkspaceModel.HEALTH_BEHIND
        if behind_count > 0 and (behind_count / count) > 0.2
        else WorkspaceModel.HEALTH_ON_TRACK
    )

    workspace.progress = progress
    workspace.health_status = health_status
    workspace.save(update_fields=['progress', 'health_status'])

# Заглушка ставки (условных единиц/час), если у проекта нет hourly_rate
DEFAULT_HOURLY_RATE = 1000


def check_project_budget(project):
    """
    Проверка порогов бюджета по стоимости времени (TimeLog).

    Стоимость: Sum(TimeLog.duration_minutes) / 60 * hourly_rate.
    Процент: (total_cost / project.budget) * 100.
    Уведомление только при переходе: 80% (warning), 100% (critical).
    При увеличении бюджета уровень сбрасывается в pre_save проекта.
    """
    from apps.todo.models import Project as ProjectModel
    from apps.timetracking.models import TimeLog

    if not project or not project.pk:
        return

    budget_total = project.budget_total or project.budget
    if not budget_total or budget_total <= 0:
        return

    total_minutes = (
        TimeLog.objects.filter(workitem__project=project)
        .aggregate(total=Sum('duration_minutes'))['total']
        or 0
    )
    if total_minutes is None:
        total_minutes = 0
    hourly_rate = getattr(project, 'hourly_rate', None) or DEFAULT_HOURLY_RATE
    if hourly_rate <= 0:
        hourly_rate = DEFAULT_HOURLY_RATE
    total_cost = Decimal(total_minutes) / 60 * Decimal(str(hourly_rate))
    try:
        percent = float(total_cost / budget_total * 100)
    except (TypeError, ZeroDivisionError):
        return

    current_level = getattr(
        project, 'last_budget_alert_level', ProjectModel.BUDGET_ALERT_NONE
    )

    if percent >= ProjectModel.BUDGET_ALERT_CRITICAL and current_level < ProjectModel.BUDGET_ALERT_CRITICAL:
        _send_budget_alert(project, percent, ProjectModel.BUDGET_ALERT_CRITICAL)
        project.last_budget_alert_level = ProjectModel.BUDGET_ALERT_CRITICAL
        project._skip_signal = True
        project.save(update_fields=['last_budget_alert_level'])
        return

    if percent >= ProjectModel.BUDGET_ALERT_WARNING and current_level < ProjectModel.BUDGET_ALERT_WARNING:
        _send_budget_alert(project, percent, ProjectModel.BUDGET_ALERT_WARNING)
        project.last_budget_alert_level = ProjectModel.BUDGET_ALERT_WARNING
        project._skip_signal = True
        project.save(update_fields=['last_budget_alert_level'])


def _send_budget_alert(project, percent, level):
    """Отправка уведомления: лог синхронно, Telegram — асинхронно (Celery)."""
    from apps.todo.models import Project as ProjectModel
    from apps.core.models import WorkspaceMember

    if level == ProjectModel.BUDGET_ALERT_CRITICAL:
        message = f"Бюджет исчерпан! Проект '{project.name}': израсходовано {percent:.0f}% (по учёту времени)."
    else:
        message = (
            f"⚠️ Бюджет проекта '{project.name}': израсходовано {percent:.0f}% "
            "(по учёту времени). Порог 80%."
        )
    logger.warning("Budget alert: %s", message)
    try:
        admins = WorkspaceMember.objects.filter(
            workspace=project.workspace,
            role__in=[WorkspaceMember.ROLE_OWNER, WorkspaceMember.ROLE_ADMIN],
        ).values_list('user_id', flat=True)
        user_ids = list(admins)
        if user_ids:
            from apps.notifications.tasks import send_telegram_message

            def dispatch():
                for uid in user_ids:
                    send_telegram_message.delay(uid, message)

            transaction.on_commit(dispatch)
    except Exception as e:
        logger.warning("Budget alert notification failed: %s", e)
