"""
Schedule models for Office Suite 360.
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.todo.models import WorkItem


class Resource(models.Model):
    """Ресурс для расписания (изолирован по workspace)."""
    
    name = models.CharField(
        max_length=255,
        verbose_name=_('Name')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description')
    )
    workspace = models.ForeignKey(
        'core.Workspace',
        on_delete=models.CASCADE,
        related_name='resources',
        verbose_name=_('Workspace')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at')
    )
    
    class Meta:
        verbose_name = 'Ресурс'
        verbose_name_plural = 'Ресурсы'
        db_table = 'resources'
        indexes = [
            models.Index(fields=['workspace']),
        ]
    
    def __str__(self):
        return self.name


class ScheduleEntry(models.Model):
    """Запись расписания (слот с началом и концом)."""
    
    REPEAT_NONE = 'none'
    REPEAT_DAILY = 'daily'
    REPEAT_WEEKLY = 'weekly'
    REPEAT_MONTHLY = 'monthly'
    REPEAT_YEARLY = 'yearly'
    
    REPEAT_CHOICES = [
        (REPEAT_NONE, _('None')),
        (REPEAT_DAILY, _('Daily')),
        (REPEAT_WEEKLY, _('Weekly')),
        (REPEAT_MONTHLY, _('Monthly')),
        (REPEAT_YEARLY, _('Yearly')),
    ]
    
    start_time = models.DateTimeField(
        verbose_name=_('Start Time')
    )
    end_time = models.DateTimeField(
        verbose_name=_('End Time')
    )
    # Старые поля оставлены для обратной совместимости (можно удалить после миграции данных)
    date = models.DateField(
        null=True,
        blank=True,
        verbose_name=_('Date')
    )
    time = models.TimeField(
        null=True,
        blank=True,
        verbose_name=_('Time')
    )
    duration = models.DurationField(
        null=True,
        blank=True,
        verbose_name=_('Duration')
    )
    repeat_pattern = models.CharField(
        max_length=20,
        choices=REPEAT_CHOICES,
        default=REPEAT_NONE,
        verbose_name=_('Repeat Pattern')
    )
    related_workitem = models.OneToOneField(
        WorkItem,
        on_delete=models.CASCADE,
        related_name='schedule_entry',
        null=True,
        blank=True,
        verbose_name=_('Related Work Item')
    )
    resource = models.ForeignKey(
        Resource,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='schedule_entries',
        verbose_name=_('Resource')
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
        verbose_name = 'Запись расписания'
        verbose_name_plural = 'Записи расписания'
        db_table = 'schedule_entries'
        ordering = ['start_time']
        indexes = [
            models.Index(fields=['start_time', 'end_time']),
            models.Index(fields=['resource']),
            models.Index(fields=['related_workitem']),
        ]
    
    def __str__(self):
        return f"{self.start_time} - {self.end_time}"
