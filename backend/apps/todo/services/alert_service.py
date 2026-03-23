"""
Alert service для проверки дедлайнов и перерасхода времени (Task 1.2).

Запускается через management command `run_alerts` по расписанию (cron).
"""
import logging
from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum, F
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.todo.models import WorkItem

logger = logging.getLogger(__name__)


def check_deadlines():
    """
    Проверка дедлайнов задач и отправка уведомлений.
    
    Логика (от критичного к менее критичному):
    1. Просрочено: due_date < today
    2. 24 часа: today <= due_date <= today+24h
    3. 48 часов: today+24h < due_date <= today+48h
    
    Использует DateField (due_date), поэтому сравниваем с .date().
    """
    today = timezone.now().date()
    tomorrow = today + timedelta(days=1)
    day_after_tomorrow = today + timedelta(days=2)
    
    alerts_sent = 0
    
    # 1. Просроченные задачи (due_date < today)
    overdue_tasks = WorkItem.objects.filter(
        due_date__lt=today,
        status__in=[WorkItem.STATUS_TODO, WorkItem.STATUS_IN_PROGRESS, WorkItem.STATUS_REVIEW],
        deadline_notification_sent__in=[
            WorkItem.ALERT_NONE,
            WorkItem.ALERT_48H,
            WorkItem.ALERT_24H
        ]
    ).select_related('project', 'created_by')
    
    for task in overdue_tasks:
        _send_notification(
            task,
            f"⚠️ ПРОСРОЧЕНО: Задача '{task.title}' просрочена (дедлайн: {task.due_date})"
        )
        task.deadline_notification_sent = WorkItem.ALERT_OVERDUE
        task.save(update_fields=['deadline_notification_sent'])
        alerts_sent += 1
    
    # 2. Задачи с дедлайном "завтра" (due_date == tomorrow)
    tomorrow_tasks = WorkItem.objects.filter(
        due_date=tomorrow,
        status__in=[WorkItem.STATUS_TODO, WorkItem.STATUS_IN_PROGRESS, WorkItem.STATUS_REVIEW],
        deadline_notification_sent__in=[WorkItem.ALERT_NONE, WorkItem.ALERT_48H]
    ).select_related('project', 'created_by')
    
    for task in tomorrow_tasks:
        _send_notification(
            task,
            f"⏰ СРОЧНО: До дедлайна задачи '{task.title}' осталось < 24 часов (дедлайн: {task.due_date})"
        )
        task.deadline_notification_sent = WorkItem.ALERT_24H
        task.save(update_fields=['deadline_notification_sent'])
        alerts_sent += 1
    
    # 3. Задачи с дедлайном "послезавтра" (due_date == day_after_tomorrow)
    two_days_tasks = WorkItem.objects.filter(
        due_date=day_after_tomorrow,
        status__in=[WorkItem.STATUS_TODO, WorkItem.STATUS_IN_PROGRESS, WorkItem.STATUS_REVIEW],
        deadline_notification_sent=WorkItem.ALERT_NONE
    ).select_related('project', 'created_by')
    
    for task in two_days_tasks:
        _send_notification(
            task,
            f"📅 НАПОМИНАНИЕ: До дедлайна задачи '{task.title}' осталось < 48 часов (дедлайн: {task.due_date})"
        )
        task.deadline_notification_sent = WorkItem.ALERT_48H
        task.save(update_fields=['deadline_notification_sent'])
        alerts_sent += 1
    
    logger.info(f"check_deadlines: проверено задач, отправлено уведомлений: {alerts_sent}")
    return alerts_sent


def check_time_estimates():
    """
    Проверка перерасхода времени (> 20% от estimated_hours).
    
    Использует TimeLog.duration_minutes и WorkItem.estimated_hours.
    Формула: total_spent_hours > estimated_hours * 1.2
    """
    alerts_sent = 0
    
    # Выбираем задачи с оценкой времени и без отправленного алерта
    tasks_with_estimate = (
        WorkItem.objects.filter(
            estimated_hours__gt=0,
            time_alert_sent=False,
            status__in=[WorkItem.STATUS_TODO, WorkItem.STATUS_IN_PROGRESS, WorkItem.STATUS_REVIEW]
        )
        .annotate(
            total_minutes=Coalesce(Sum('time_logs__duration_minutes'), 0)
        )
        .select_related('project', 'created_by')
    )
    
    for task in tasks_with_estimate:
        # Конвертируем минуты в часы
        total_hours = Decimal(task.total_minutes) / 60
        threshold = task.estimated_hours * Decimal('1.2')
        
        if total_hours > threshold:
            _send_notification(
                task,
                f"💰 ПЕРЕРАСХОД ВРЕМЕНИ: Задача '{task.title}' превысила оценку на 20%+ "
                f"(план: {task.estimated_hours}ч, факт: {total_hours:.2f}ч)"
            )
            task.time_alert_sent = True
            task.save(update_fields=['time_alert_sent'])
            alerts_sent += 1
    
    logger.info(f"check_time_estimates: проверено задач, отправлено уведомлений: {alerts_sent}")
    return alerts_sent


def _send_notification(task, message):
    """
    Отправка уведомления (пока в лог + заглушка).
    
    В будущем: интеграция с NotificationService/Telegram.
    """
    print(f"[NOTIFICATION] {message}")
    logger.warning(f"Alert for task #{task.id}: {message}")
    
    # Опционально: отправка через NotificationService
    try:
        from apps.notifications.services import TelegramNotificationService
        if task.created_by:
            TelegramNotificationService.send_message(
                task.created_by.id,
                message
            )
    except Exception as e:
        logger.debug(f"Failed to send Telegram notification: {e}")
