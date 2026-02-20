"""
Time tracking models for Office Suite 360.
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.todo.models import WorkItem
from apps.core.models import User


class TimeLog(models.Model):
    """Учёт времени."""
    
    workitem = models.ForeignKey(
        WorkItem,
        on_delete=models.CASCADE,
        related_name='time_logs',
        verbose_name=_('Work Item')
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='time_logs',
        verbose_name=_('User')
    )
    started_at = models.DateTimeField(
        verbose_name=_('Started At')
    )
    stopped_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Stopped At')
    )
    duration_minutes = models.IntegerField(
        null=True,
        blank=True,
        verbose_name=_('Duration (minutes)')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description')
    )
    billable = models.BooleanField(
        default=True,
        verbose_name=_('Billable'),
        help_text=_('Подлежит ли биллингу')
    )
    # Financial Snapshot (Task 2.3)
    hourly_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Hourly Rate'),
        help_text=_('Ставка на момент работы (snapshot)')
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Amount'),
        help_text=_('Итоговая стоимость лога (snapshot)')
    )
    is_paid = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name=_('Is paid'),
        help_text=_('Оплачен ли лог (Payroll)')
    )
    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Paid at'),
        help_text=_('Дата/время оплаты по ведомости')
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
        verbose_name = 'Тайм-лог'
        verbose_name_plural = 'Тайм-логи'
        db_table = 'time_logs'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['workitem', 'user']),
            models.Index(fields=['started_at']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.workitem.title[:50]} - {self.duration_minutes} min"
