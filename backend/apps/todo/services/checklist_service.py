"""
Сервис подзадач (ChecklistItem): пересчёт прогресса WorkItem и авто-перемещение по колонкам.
STEP 3.5 — Умные задачи: подзадачи управляют статусом и прогрессом.
"""
from django.db import transaction

from apps.todo.models import WorkItem, ChecklistItem
from apps.kanban.models import Column


def recalc_workitem_progress_from_checklist(workitem):
    """
    Пересчитать progress задачи по чек-листу: (done / total) * 100.
    Если подзадач нет — progress не меняем (оставляем текущий).
    """
    items = list(workitem.checklist_items.all())
    total = len(items)
    if total == 0:
        return
    done = sum(1 for i in items if i.is_done)
    progress = round(100 * done / total) if total else 0
    if workitem.progress != progress:
        workitem.progress = progress
        workitem._skip_signal = True
        workitem.save(update_fields=['progress', 'updated_at'])


def get_column_by_system_type(stage, system_type):
    """Колонка этапа по system_type (plan, in_progress, done)."""
    return Column.objects.filter(stage=stage, system_type=system_type).order_by('position').first()


def maybe_move_workitem_forward(workitem):
    """
    Auto-Move Forward по чек-листу:
    - Если прогресс стал > 0 и статус был PLAN (todo) — перенести в колонку IN_PROGRESS.
    - Если прогресс стал 100% — перенести в колонку DONE.
    """
    stage = workitem.stage
    if not stage:
        # Может быть задан через kanban_column
        if workitem.kanban_column_id:
            stage = workitem.kanban_column.stage
        else:
            return
    if not stage:
        return

    column_in_progress = get_column_by_system_type(stage, Column.SYSTEM_TYPE_IN_PROGRESS)
    column_done = get_column_by_system_type(stage, Column.SYSTEM_TYPE_DONE)

    new_column = None
    new_status = None

    if workitem.progress >= 100 and column_done:
        new_column = column_done
        new_status = WorkItem.STATUS_COMPLETED
    elif workitem.progress > 0 and workitem.status == WorkItem.STATUS_TODO and column_in_progress:
        new_column = column_in_progress
        new_status = WorkItem.STATUS_IN_PROGRESS

    if new_column and (workitem.kanban_column_id != new_column.id or workitem.status != new_status):
        from django.db.models import Max
        workitem.kanban_column = new_column
        workitem.stage = stage
        workitem.status = new_status
        if new_status == WorkItem.STATUS_COMPLETED:
            from django.utils import timezone
            if not workitem.completed_at:
                workitem.completed_at = timezone.now()
            workitem.progress = 100
        max_sort = WorkItem.objects.filter(kanban_column=new_column).exclude(id=workitem.id).aggregate(
            max_pos=Max('sort_order')
        )['max_pos']
        workitem.sort_order = (max_sort or -1) + 1
        workitem._skip_signal = True
        workitem.save(update_fields=[
            'kanban_column', 'stage', 'status', 'sort_order',
            'completed_at', 'progress', 'updated_at'
        ])


def complete_checklist_for_workitem(workitem):
    """
    Auto-Complete: при ручном переносе в DONE (или нажатии «Завершить») —
    все подзадачи помечаются выполненными, progress = 100.
    """
    ChecklistItem.objects.filter(workitem=workitem).update(is_done=True)
    workitem.progress = 100
    workitem._skip_signal = True
    workitem.save(update_fields=['progress', 'updated_at'])
