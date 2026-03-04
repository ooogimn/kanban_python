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


def _duration_days(workitem: WorkItem) -> int:
    """
    Длительность в днях как разница due_date-start_date (без +1).
    Так сохраняется стабильная ширина отрезка при переносах.
    """
    if not workitem.start_date or not workitem.due_date:
        return 0
    return max(0, (workitem.due_date - workitem.start_date).days)


def _compute_successor_dates(successor: WorkItem) -> tuple | None:
    """
    Рассчитать новые даты successor по всем его predecessor-зависимостям.
    Поддержка типов: FS/SS/FF/SF.
    """
    deps = TaskDependency.objects.filter(successor=successor).select_related('predecessor')
    if not deps.exists():
        return None

    required_start = None
    required_due = None
    has_constraints = False

    for dep in deps:
        pred = dep.predecessor
        if pred.deleted_at:
            continue
        if dep.type in (TaskDependency.TYPE_FS, TaskDependency.TYPE_FF) and not pred.due_date:
            continue
        if dep.type in (TaskDependency.TYPE_SS, TaskDependency.TYPE_SF) and not pred.start_date:
            continue

        lag = timedelta(days=dep.lag_days)
        has_constraints = True
        if dep.type == TaskDependency.TYPE_FS:
            candidate = pred.due_date + lag
            required_start = candidate if required_start is None else max(required_start, candidate)
        elif dep.type == TaskDependency.TYPE_SS:
            candidate = pred.start_date + lag
            required_start = candidate if required_start is None else max(required_start, candidate)
        elif dep.type == TaskDependency.TYPE_FF:
            candidate = pred.due_date + lag
            required_due = candidate if required_due is None else max(required_due, candidate)
        elif dep.type == TaskDependency.TYPE_SF:
            candidate = pred.start_date + lag
            required_due = candidate if required_due is None else max(required_due, candidate)

    if not has_constraints:
        return None

    current_start = successor.start_date or successor.due_date
    current_due = successor.due_date or successor.start_date
    if not current_start and not current_due:
        return None
    if not current_start:
        current_start = current_due
    if not current_due:
        current_due = current_start

    duration = _duration_days(successor)

    if required_due is not None:
        min_start_from_due = required_due - timedelta(days=duration)
        if required_start is not None:
            new_start = max(required_start, min_start_from_due)
        else:
            new_start = min_start_from_due
    elif required_start is not None:
        new_start = required_start
    else:
        new_start = current_start

    new_due = new_start + timedelta(days=duration)
    if required_due is not None and new_due < required_due:
        new_due = required_due
        new_start = new_due - timedelta(days=duration)
    if required_start is not None and new_start < required_start:
        new_start = required_start
        new_due = new_start + timedelta(days=duration)

    return new_start, new_due


def _recalculate_dates_impl(workitem: WorkItem, depth: int, visited: set[int] | None = None) -> None:
    """Внутренняя реализация каскадного пересчёта дат (без atomic)."""
    if depth >= MAX_RECURSION_DEPTH:
        return

    if visited is None:
        visited = set()
    if workitem.id in visited:
        return
    visited.add(workitem.id)

    for dep in TaskDependency.objects.filter(predecessor=workitem).select_related('successor'):
        successor = dep.successor
        if successor.deleted_at:
            continue

        computed = _compute_successor_dates(successor)
        if not computed:
            continue
        new_start, new_due = computed

        if successor.start_date != new_start or successor.due_date != new_due:
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

            _recalculate_dates_impl(successor, depth + 1, visited)


def recalculate_dates(workitem: WorkItem, depth: int = 0) -> None:
    """
    Пересчёт дат successor-задач при изменении workitem (predecessor).
    Finish-to-Start: successor.start_date = predecessor.due_date + lag_days.
    SPRINT 1: при первом вызове (depth=0) выполняется в transaction.atomic.
    """
    if depth == 0:
        with transaction.atomic():
            _recalculate_dates_impl(workitem, depth, visited=set())
    else:
        _recalculate_dates_impl(workitem, depth, visited=set())
