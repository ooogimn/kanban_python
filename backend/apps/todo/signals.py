"""
Signals for todo app - синхронизация Task с другими компонентами и запись в AuditLog.
"""
from django.db.models import Max
from django.db.models.signals import post_save, post_delete, m2m_changed, pre_save
from django.dispatch import receiver
from django.utils import timezone
from .models import WorkItem, Project, ChecklistItem
from .services.checklist_service import (
    recalc_workitem_progress_from_checklist,
    maybe_move_workitem_forward,
)
from apps.kanban.models import Stage, Column
from apps.notifications.audit import log_audit
from apps.notifications.models import AuditLog
from apps.calendar.models import CalendarEvent
from apps.gantt.models import GanttTask
from apps.notifications.services import NotificationService, TelegramNotificationService


@receiver(post_save, sender=WorkItem)
def task_post_save(sender, instance, created, **kwargs):
    """
    Сигнал при сохранении WorkItem.
    Создаёт/обновляет связанные объекты в Kanban, Calendar, Gantt.
    """
    # Предотвращаем рекурсию
    if hasattr(instance, '_skip_signal'):
        return
    
    # Если задача удалена (soft delete), пропускаем
    if instance.deleted_at:
        return
    
    # Синхронизация kanban_column и sort_order (WorkItem — единый источник истины)
    if instance.project:
        _sync_kanban_column(instance, created)
    
    # Создание/обновление CalendarEvent (при наличии хотя бы одной даты)
    if instance.start_date or instance.due_date:
        _sync_calendar_event(instance, created)
    
    # Создание/обновление GanttTask
    if instance.project:
        _sync_gantt_task(instance, created)

    # STEP 4: Auto-Scheduling — пересчёт дат successor-задач при изменении due_date
    if instance.due_date and instance.project:
        try:
            from apps.gantt.services import recalculate_dates
            recalculate_dates(instance)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning('GanttService.recalculate_dates: %s', e)

    # Отправка WebSocket уведомлений
    _send_websocket_notifications(instance, created)

    # Журнал активности (AuditLog)
    action = AuditLog.ACTION_CREATE if created else AuditLog.ACTION_UPDATE
    log_audit(action, 'workitem', instance.id, changes={'title': instance.title})

    # Экспорт в Google Sheets при любом изменении (не чаще 1 раза в минуту на проект)
    if instance.project_id:
        try:
            from apps.integrations.tasks import trigger_export_on_change
            trigger_export_on_change(instance.project_id)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning('trigger_export_on_change: %s', e)

    # Пересчёт бюджета проекта при изменении cost
    if instance.project_id:
        try:
            from apps.finance.services import recalc_project_budget
            recalc_project_budget(instance.project)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning('recalc_project_budget: %s', e)

    # Пересчёт прогресса и здоровья этапа (Stage)
    stage = instance.stage
    if not stage and instance.kanban_column_id:
        stage = getattr(instance.kanban_column, 'stage', None)
    if stage:
        try:
            from apps.kanban.services import ProgressService
            ProgressService.recalculate_stage_progress(stage)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning('recalculate_stage_progress: %s', e)
    if instance.project_id:
        try:
            from apps.kanban.services import ProgressService
            ProgressService.recalculate_project_progress(instance.project)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning('recalculate_project_progress: %s', e)


@receiver(post_save, sender=ChecklistItem)
def checklist_item_post_save(sender, instance, **kwargs):
    """
    При сохранении подзадачи: пересчитать progress WorkItem и при необходимости
    переместить задачу в колонку «В работе» или «Готово».
    """
    workitem = instance.workitem
    if getattr(workitem, '_skip_signal', False):
        return
    try:
        recalc_workitem_progress_from_checklist(workitem)
        workitem.refresh_from_db()
        maybe_move_workitem_forward(workitem)
        workitem.refresh_from_db()
        stage = workitem.stage or (workitem.kanban_column.stage if workitem.kanban_column_id else None)
        if stage:
            from apps.kanban.services import ProgressService
            ProgressService.recalculate_stage_progress(stage)
        if workitem.project_id:
            from apps.kanban.services import ProgressService
            ProgressService.recalculate_project_progress(workitem.project)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning('checklist_item_post_save: %s', e)


def _sync_kanban_column(workitem, created):
    """Синхронизация kanban_column и sort_order (WorkItem — единый источник истины)."""
    try:
        # Если kanban_column уже задана явно (при создании через Канбан) — синхронизируем stage и sort_order
        if workitem.kanban_column_id:
            col = workitem.kanban_column
            update_fields = []
            if workitem.stage_id != col.stage_id:
                workitem.stage = col.stage
                update_fields.append('stage')
            if workitem.sort_order == 0 or created:
                max_sort = (
                    workitem.__class__.objects.filter(kanban_column=workitem.kanban_column)
                    .exclude(id=workitem.id)
                    .aggregate(max_pos=Max('sort_order'))['max_pos']
                )
                new_sort = (max_sort or -1) + 1
                if workitem.sort_order != new_sort:
                    workitem.sort_order = new_sort
                    update_fields.append('sort_order')
            if update_fields:
                workitem._skip_signal = True
                workitem.save(update_fields=update_fields)
            return

        # Бэклог: задача без колонки и без спринта — оставляем как есть (stage_id=None)
        if workitem.stage_id is None and workitem.kanban_column_id is None:
            return

        # kanban_column не задана — определяем по статусу и проекту (дефолтный спринт)
        stage = Stage.objects.filter(project=workitem.project, is_default=True).first()
        if not stage:
            stage = Stage.objects.create(
                name=f"{workitem.project.name} Board",
                project=workitem.project,
                is_default=True
            )
            # Колонки PLAN, IN_PROGRESS, DONE создаются в kanban.signals.stage_post_save_create_columns

        new_column = _get_column_for_status(stage, workitem.status)
        need_save = False

        if new_column and workitem.stage_id != new_column.stage_id:
            workitem.stage = new_column.stage
            need_save = True
        if workitem.kanban_column != new_column:
            workitem.kanban_column = new_column
            workitem.stage = new_column.stage
            need_save = True

        if created or need_save:
            max_sort = (
                workitem.__class__.objects.filter(kanban_column=new_column)
                .exclude(id=workitem.id)
                .aggregate(max_pos=Max('sort_order'))['max_pos']
            )
            workitem.sort_order = (max_sort or -1) + 1
            need_save = True

        if need_save:
            workitem._skip_signal = True
            update_fields = ['kanban_column', 'sort_order']
            if workitem.stage_id != (new_column.stage_id if new_column else None):
                update_fields.append('stage')
            workitem.save(update_fields=update_fields)

    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error syncing kanban column for workitem {workitem.id}: {e}")


def _get_column_for_status(stage, status):
    """Получение колонки по статусу задачи."""
    status_to_column_type = {
        WorkItem.STATUS_TODO: Column.COLUMN_TYPE_TODO,
        WorkItem.STATUS_IN_PROGRESS: Column.COLUMN_TYPE_IN_PROGRESS,
        WorkItem.STATUS_REVIEW: Column.COLUMN_TYPE_REVIEW,
        WorkItem.STATUS_COMPLETED: Column.COLUMN_TYPE_COMPLETED,
        WorkItem.STATUS_CANCELLED: Column.COLUMN_TYPE_TODO,  # Отменённые задачи возвращаем в To Do
    }
    
    column_type = status_to_column_type.get(status, Column.COLUMN_TYPE_TODO)
    column = Column.objects.filter(stage=stage, column_type=column_type).first()
    
    if not column:
        # Создаём колонку, если её нет
        max_position = Column.objects.filter(stage=stage).count()
        column = Column.objects.create(
            name=status.replace('_', ' ').title(),
            column_type=column_type,
            system_type=Column.SYSTEM_TYPE_OTHER,
            stage=stage,
            position=max_position
        )
    
    return column


def _sync_calendar_event(workitem, created):
    """Синхронизация с CalendarEvent: создание/обновление при start_date или due_date."""
    try:
        # Даты события: если задана одна — вторая подставляется из той же
        start_date = workitem.start_date or workitem.due_date
        end_date = workitem.due_date or workitem.start_date
        if not start_date or not end_date:
            return

        owner = workitem.created_by or workitem.assigned_to.first()
        if not owner:
            return

        # Преобразуем в datetime
        from datetime import datetime, time
        if isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date)
        if isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date)
        if isinstance(start_date, datetime.date) and not isinstance(start_date, datetime):
            start_date = datetime.combine(start_date, time(9, 0))
        if isinstance(end_date, datetime.date) and not isinstance(end_date, datetime):
            end_date = datetime.combine(end_date, time(17, 0))

        # Получаем или создаём событие (заголовок = название задачи, даты синхронизированы)
        event, event_created = CalendarEvent.objects.get_or_create(
            related_workitem=workitem,
            defaults={
                'title': workitem.title,
                'description': workitem.description or '',
                'start_date': start_date,
                'end_date': end_date,
                'all_day': False,
                'color': _get_color_for_priority(workitem.priority),
                'owner': owner,
            }
        )

        if not event_created:
            # Обновляем существующее: заголовок и даты в соответствии с задачей
            event.title = workitem.title
            event.description = workitem.description or ''
            event.start_date = start_date
            event.end_date = end_date
            event.color = _get_color_for_priority(workitem.priority)
            event._skip_signal = True
            event.save()

    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error syncing calendar event for workitem {workitem.id}: {e}")


def _get_color_for_priority(priority):
    """Получение цвета по приоритету."""
    colors = {
        WorkItem.PRIORITY_LOW: '#90EE90',
        WorkItem.PRIORITY_MEDIUM: '#FFD700',
        WorkItem.PRIORITY_HIGH: '#FF6347',
        WorkItem.PRIORITY_URGENT: '#DC143C',
    }
    return colors.get(priority, '#3788d8')


def _sync_gantt_task(workitem, created):
    """Синхронизация с GanttTask."""
    try:
        if not workitem.start_date or not workitem.due_date:
            return
        
        # Получаем или создаём задачу Ганта
        gantt_task, gantt_created = GanttTask.objects.get_or_create(
            related_workitem=workitem,
            defaults={
                'name': workitem.title,
                'start_date': workitem.start_date,
                'end_date': workitem.due_date,
                'progress': workitem.progress,
            }
        )
        
        if not gantt_created:
            # Обновляем существующую задачу
            gantt_task.name = workitem.title
            gantt_task.start_date = workitem.start_date
            gantt_task.end_date = workitem.due_date
            gantt_task.progress = workitem.progress
            
            # Предотвращаем рекурсию
            gantt_task._skip_signal = True
            gantt_task.save()
            
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error syncing gantt task for workitem {workitem.id}: {e}")


def _send_websocket_notifications(workitem, created):
    """Отправка WebSocket уведомлений при изменении задачи."""
    try:
        # Простая сериализация для WebSocket (без DRF serializer)
        task_data = {
            'id': workitem.id,
            'title': workitem.title,
            'status': workitem.status,
            'priority': workitem.priority,
            'due_date': workitem.due_date.isoformat() if workitem.due_date else None,
            'progress': workitem.progress,
            'project_id': workitem.project_id,
            'created_at': workitem.created_at.isoformat() if workitem.created_at else None,
            'updated_at': workitem.updated_at.isoformat() if workitem.updated_at else None,
        }
        
        # Отправляем обновление в проект
        if workitem.project:
            if created:
                NotificationService.send_task_created(workitem.project.id, task_data)
            else:
                NotificationService.send_task_updated(workitem.project.id, task_data)
            NotificationService.send_project_update(workitem.project.id, {'type': 'task_updated'})
        
        # Отправляем обновление пользователям, назначенным на задачу
        for user in workitem.assigned_to.all():
            NotificationService.send_task_update(user.id, task_data)
        
        # Отправляем обновление наблюдателям
        for user in workitem.watchers.all():
            NotificationService.send_task_update(user.id, task_data)
            
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error sending WebSocket notification for workitem {workitem.id}: {e}")


@receiver(m2m_changed, sender=WorkItem.assigned_to.through)
def workitem_assigned_to_changed(sender, instance, action, pk_set, **kwargs):
    """
    При добавлении исполнителей (assigned_to) отправляем уведомление в Telegram:
    «Вам назначена задача: {title}».
    """
    if action != 'post_add' or not pk_set:
        return
    if getattr(instance, '_skip_signal', False):
        return
    title = (instance.title or 'Без названия')[:200]
    text = f"🆕 Вам назначена задача: {title}"
    for user_id in pk_set:
        TelegramNotificationService.send_message(user_id, text)


@receiver(post_delete, sender=WorkItem)
def task_post_delete(sender, instance, **kwargs):
    """Запись в AuditLog и пересчёт бюджета при удалении задачи (физическое удаление)."""
    log_audit(AuditLog.ACTION_DELETE, 'workitem', instance.id, changes={'title': instance.title})
    if instance.project_id:
        try:
            from apps.finance.services import recalc_project_budget
            from apps.todo.models import Project
            project = Project.objects.filter(id=instance.project_id).first()
            if project:
                recalc_project_budget(project)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning('recalc_project_budget on delete: %s', e)


@receiver(pre_save, sender=Project)
def project_pre_save(sender, instance, **kwargs):
    """
    При увеличении бюджета проекта сбрасываем уровень последнего алерта,
    чтобы при следующем пересчёте (например после TimeLog) снова сработали
    пороги 80% / 100%.
    """
    if not instance.pk:
        return
    try:
        old = Project.objects.get(pk=instance.pk)
    except Project.DoesNotExist:
        return
    old_budget = old.budget or 0
    new_budget = instance.budget or 0
    if new_budget > old_budget:
        instance.last_budget_alert_level = Project.BUDGET_ALERT_NONE


@receiver(post_save, sender=Project)
def project_post_save(sender, instance, created, **kwargs):
    """Запись в AuditLog при создании/изменении проекта; пересчёт прогресса Workspace (SPRINT 1)."""
    if hasattr(instance, '_skip_signal') and instance._skip_signal:
        return
    action = AuditLog.ACTION_CREATE if created else AuditLog.ACTION_UPDATE
    log_audit(action, 'project', instance.id, changes={'name': instance.name})
    if instance.workspace_id:
        try:
            from apps.core.services import recalculate_workspace_progress
            recalculate_workspace_progress(instance.workspace)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning('recalculate_workspace_progress: %s', e)


@receiver(post_delete, sender=Project)
def project_post_delete(sender, instance, **kwargs):
    """Запись в AuditLog при удалении проекта."""
    log_audit(AuditLog.ACTION_DELETE, 'project', instance.id, changes={'name': instance.name})
