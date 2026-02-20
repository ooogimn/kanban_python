"""
Calendar models for Office Suite 360.
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.todo.models import WorkItem
from apps.core.models import User


class CalendarEvent(models.Model):
    """Событие календаря."""
    
    title = models.CharField(
        max_length=500,
        verbose_name=_('Title')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description')
    )
    start_date = models.DateTimeField(
        verbose_name=_('Start Date')
    )
    end_date = models.DateTimeField(
        verbose_name=_('End Date')
    )
    all_day = models.BooleanField(
        default=False,
        verbose_name=_('All Day')
    )
    recurrence_rule = models.CharField(
        max_length=255,
        blank=True,
        verbose_name=_('Recurrence Rule')
    )
    color = models.CharField(
        max_length=7,
        default='#3788d8',
        verbose_name=_('Color')
    )
    location = models.CharField(
        max_length=255,
        blank=True,
        verbose_name=_('Location')
    )
    related_workitem = models.OneToOneField(
        WorkItem,
        on_delete=models.CASCADE,
        related_name='calendar_event',
        null=True,
        blank=True,
        verbose_name=_('Related Work Item')
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='calendar_events',
        verbose_name=_('Owner')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at')
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_('Updated at')
    )
    
    # M2M relationships
    attendees = models.ManyToManyField(
        User,
        related_name='attended_events',
        blank=True,
        verbose_name=_('Attendees')
    )
    
    class Meta:
        verbose_name = 'Событие календаря'
        verbose_name_plural = 'События календаря'
        db_table = 'calendar_events'
        ordering = ['start_date']
        indexes = [
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['owner']),
            models.Index(fields=['related_workitem']),
        ]
    
    def __str__(self):
        return self.title
