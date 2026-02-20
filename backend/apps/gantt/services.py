"""
Gantt services: Auto-Scheduling (STEP 4 — Умный Гант).
Пересчёт дат зависимых задач при изменении predecessor.
SPRINT 1: каскадное обновление обёрнуто в transaction.atomic.
"""
from datetime import timedelta

from django.db import transaction

from apps.todo.models import WorkItem, TaskDependency
from apps.gantt.models import GanttTask


# Лимит глубины рекурсии для защиты от бесконечных циклов
MAX_RECURSION_DEPTH = 50


def _would_create_cycle(predecessor_id: int, successor_id: int) -> bool:
    """
    Проверка: создание зависимости predecessor -> successor приведёт к циклу?
    Цикл: если successor достигает predecessor по цепочке successors.
    """
    if predecessor_id == successor_id:
        return True
    visited = {successor_id}
    stack = [successor_id]
    depth = 0
    while stack and depth < MAX_RECURSION_DEPTH:
        depth += 1
        current_id = stack.pop()
        for dep in TaskDependency.objects.filter(predecessor_id=current_id).select_related('successor'):
            succ_id = dep.successor_id
            if succ_id == predecessor_id:
                return True
            if succ_id not in visited:
                visited.add(succ_id)
                stack.append(succ_id)
    return False


def check_cycle(predecessor_id: int, successor_id: int) -> bool:
    """Возвращает True, если создание зависимости вызовет цикл."""
    return _would_create_cycle(predecessor_id, successor_id)


def _recalculate_dates_impl(workitem: WorkItem, depth: int) -> None:
    """Внутренняя реализация каскадного пересчёта дат (без atomic)."""
    if depth >= MAX_RECURSION_DEPTH:
        return

    predecessor_due = workitem.due_date
    if not predecessor_due:
        return

    for dep in TaskDependency.objects.filter(predecessor=workitem).select_related('successor'):
        successor = dep.successor
        if successor.deleted_at:
            continue

        lag = timedelta(days=dep.lag_days)
        if dep.type == TaskDependency.TYPE_FS:
            new_start = predecessor_due + lag
            old_start = successor.start_date
            old_due = successor.due_date
            if not old_start or not old_due:
                duration_days = 1
            else:
                duration_days = max(1, (old_due - old_start).days)
            new_due = new_start + timedelta(days=duration_days)

            if not successor.start_date or successor.start_date < new_start:
                successor.start_date = new_start
                successor.due_date = new_due
                successor._skip_signal = True
                successor.save(update_fields=['start_date', 'due_date', 'updated_at'])

                try:
                    gt = GanttTask.objects.get(related_workitem=successor)
                    gt.start_date = new_start
                    gt.end_date = new_due
                    gt.progress = successor.progress
                    gt._skip_signal = True
                    gt.save(update_fields=['start_date', 'end_date', 'progress', 'updated_at'])
                except GanttTask.DoesNotExist:
                    pass

                _recalculate_dates_impl(successor, depth + 1)


def recalculate_dates(workitem: WorkItem, depth: int = 0) -> None:
    """
    Пересчёт дат successor-задач при изменении workitem (predecessor).
    Finish-to-Start: successor.start_date = predecessor.due_date + lag_days.
    SPRINT 1: при первом вызове (depth=0) выполняется в transaction.atomic.
    """
    if depth == 0:
        with transaction.atomic():
            _recalculate_dates_impl(workitem, depth)
    else:
        _recalculate_dates_impl(workitem, depth)
