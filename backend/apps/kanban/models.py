"""
Kanban models for Office Suite 360.
Этап (Stage) — канбан-доска с обязательными колонками PLAN / IN_PROGRESS / DONE.
WorkItem отображается на этапе через привязку к Column (и к Stage).
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.todo.models import Project


# Алиас для обратной совместимости (постепенная замена в коде)
Board = None  # будет задан после определения Stage


class Stage(models.Model):
    """
    Этап проекта (ранее Kanban Board).
    Прогресс и здоровье пересчитываются при изменении задач на этапе.
    """
    HEALTH_ON_TRACK = 'on_track'
    HEALTH_BEHIND = 'behind'
    HEALTH_CHOICES = [
        (HEALTH_ON_TRACK, _('On Track')),
        (HEALTH_BEHIND, _('Behind')),
    ]

    name = models.CharField(
        max_length=255,
        verbose_name=_('Name')
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='boards',  # обратная совместимость: Project.boards
        null=True,
        blank=True,
        verbose_name=_('Project')
    )
    is_default = models.BooleanField(
        default=False,
        verbose_name=_('Is Default')
    )
    progress = models.IntegerField(
        default=0,
        verbose_name=_('Progress (%)'),
        help_text=_('0-100, пересчитывается по задачам этапа')
    )
    health_status = models.CharField(
        max_length=20,
        choices=HEALTH_CHOICES,
        default=HEALTH_ON_TRACK,
        verbose_name=_('Health Status')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at')
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_('Updated at')
    )

    class Meta:
        verbose_name = 'Этап (канбан)'
        verbose_name_plural = 'Этапы (канбан)'
        db_table = 'boards'  # совместимость: таблица не переименовываем
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['project']),
        ]

    def __str__(self):
        return self.name


# Обратная совместимость: Board указывает на Stage (та же таблица)
Board = Stage


class Column(models.Model):
    """Колонка этапа (Stage). system_type — якорь для расчёта прогресса."""

    # Типы для отображения и маппинга статусов WorkItem
    COLUMN_TYPE_TODO = 'todo'
    COLUMN_TYPE_IN_PROGRESS = 'in_progress'
    COLUMN_TYPE_REVIEW = 'review'
    COLUMN_TYPE_COMPLETED = 'completed'
    COLUMN_TYPE_CHOICES = [
        (COLUMN_TYPE_TODO, _('To Do')),
        (COLUMN_TYPE_IN_PROGRESS, _('In Progress')),
        (COLUMN_TYPE_REVIEW, _('Review')),
        (COLUMN_TYPE_COMPLETED, _('Completed')),
    ]

    # Системные типы для формулы прогресса (обязательные колонки этапа)
    SYSTEM_TYPE_PLAN = 'plan'
    SYSTEM_TYPE_IN_PROGRESS = 'in_progress'
    SYSTEM_TYPE_DONE = 'done'
    SYSTEM_TYPE_OTHER = 'other'
    SYSTEM_TYPE_CHOICES = [
        (SYSTEM_TYPE_PLAN, _('In plan')),
        (SYSTEM_TYPE_IN_PROGRESS, _('In progress')),
        (SYSTEM_TYPE_DONE, _('Done')),
        (SYSTEM_TYPE_OTHER, _('Other')),
    ]

    name = models.CharField(
        max_length=100,
        verbose_name=_('Name')
    )
    column_type = models.CharField(
        max_length=50,
        choices=COLUMN_TYPE_CHOICES,
        default=COLUMN_TYPE_TODO,
        verbose_name=_('Column Type')
    )
    system_type = models.CharField(
        max_length=20,
        choices=SYSTEM_TYPE_CHOICES,
        default=SYSTEM_TYPE_OTHER,
        verbose_name=_('System Type'),
        help_text=_('plan / in_progress / done — для расчёта прогресса этапа')
    )
    position = models.IntegerField(
        default=0,
        verbose_name=_('Position')
    )
    stage = models.ForeignKey(
        Stage,
        on_delete=models.CASCADE,
        related_name='columns',
        verbose_name=_('Stage')
    )
    wip_limit = models.IntegerField(
        null=True,
        blank=True,
        verbose_name=_('WIP Limit')
    )
    color = models.CharField(
        max_length=7,
        default='#fbbf24',
        verbose_name=_('Color'),
        help_text=_('Hex color for column (Imperial Illumination)')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at')
    )

    class Meta:
        verbose_name = 'Колонка канбана'
        verbose_name_plural = 'Колонки канбана'
        db_table = 'columns'
        ordering = ['position']
        indexes = [
            models.Index(fields=['stage', 'position']),
        ]

    @property
    def board(self):
        """Обратная совместимость: column.board -> stage."""
        return self.stage

    def __str__(self):
        return f"{self.stage.name} - {self.name}"
