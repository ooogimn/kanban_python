"""
Kanban services: расчёт прогресса и здоровья этапа (Stage).
"""
from decimal import Decimal

from django.utils import timezone
from django.db.models import Q

from .models import Stage, Column


class ProgressService:
    """
    Пересчёт progress и health_status этапа по задачам.
    Формула: ((done + 0.5 * active) / total) * 100.
    Health: behind, если есть просроченные задачи (не в done).
    """

    @staticmethod
    def recalculate_stage_progress(stage):
        """
        Пересчитать progress и health_status для этапа.
        Сохраняет stage.progress и stage.health_status.
        """
        if not stage or not stage.pk:
            return

        from apps.todo.models import WorkItem

        # Задачи на этапе: по stage FK или по колонкам этапа
        workitems_qs = WorkItem.objects.filter(
            Q(stage=stage) | Q(kanban_column__stage=stage)
        ).filter(deleted_at__isnull=True)

        total = workitems_qs.count()
        if total == 0:
            stage.progress = 0
            stage.health_status = Stage.HEALTH_ON_TRACK
            stage.save(update_fields=['progress', 'health_status'])
            return

        # Колонки этапа с system_type done / in_progress
        done_columns = set(
            Column.objects.filter(
                stage=stage,
                system_type=Column.SYSTEM_TYPE_DONE
            ).values_list('id', flat=True)
        )
        in_progress_columns = set(
            Column.objects.filter(
                stage=stage,
                system_type=Column.SYSTEM_TYPE_IN_PROGRESS
            ).values_list('id', flat=True)
        )

        done = workitems_qs.filter(kanban_column_id__in=done_columns).count()
        active = workitems_qs.filter(kanban_column_id__in=in_progress_columns).count()

        # Формула: ((done + 0.5 * active) / total) * 100
        progress_value = (Decimal(done) + Decimal('0.5') * Decimal(active)) / Decimal(total) * 100
        stage.progress = min(100, max(0, int(progress_value)))

        # Health: просроченные задачи (due_date < сегодня и не в done)
        today = timezone.now().date()
        overdue_not_done = workitems_qs.filter(
            due_date__lt=today
        ).exclude(kanban_column_id__in=done_columns).exists()

        stage.health_status = Stage.HEALTH_BEHIND if overdue_not_done else Stage.HEALTH_ON_TRACK
        stage.save(update_fields=['progress', 'health_status'])

    @staticmethod
    def recalculate_project_progress(project):
        """
        Пересчитать progress и health_status проекта по этапам (Stage).
        progress = среднее арифметическое progress всех Stage проекта.
        health_status = 'behind', если хотя бы один этап behind, иначе 'on_track'.
        """
        if not project or not project.pk:
            return

        stages = Stage.objects.filter(project_id=project.pk).values_list('progress', 'health_status')
        if not stages:
            project.progress = 0
            project.health_status = 'on_track'
            project.save(update_fields=['progress', 'health_status'])
            return
        total = len(stages)
        progress_sum = sum(s[0] for s in stages)
        project.progress = min(100, max(0, progress_sum // total))
        any_behind = any(s[1] == Stage.HEALTH_BEHIND for s in stages)
        project.health_status = (
            Stage.HEALTH_BEHIND if any_behind else Stage.HEALTH_ON_TRACK
        )
        project.save(update_fields=['progress', 'health_status'])
