"""
Gantt models for Office Suite 360.
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.todo.models import WorkItem


class GanttTask(models.Model):
    """Задача Ганта."""
    
    name = models.CharField(
        max_length=500,
        verbose_name=_('Name')
    )
    start_date = models.DateField(
        verbose_name=_('Start Date')
    )
    end_date = models.DateField(
        verbose_name=_('End Date')
    )
    progress = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name=_('Progress (%)')
    )
    related_workitem = models.OneToOneField(
        WorkItem,
        on_delete=models.CASCADE,
        related_name='gantt_task',
        null=True,
        blank=True,
        verbose_name=_('Related Work Item')
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        related_name='children',
        null=True,
        blank=True,
        verbose_name=_('Parent Task')
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
        verbose_name = 'Задача Ганта'
        verbose_name_plural = 'Задачи Ганта'
        db_table = 'gantt_tasks'
        ordering = ['start_date']
        indexes = [
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['related_workitem']),
            models.Index(fields=['parent']),
        ]
    
    def __str__(self):
        return self.name


class GanttDependency(models.Model):
    """Зависимость задач Ганта."""
    
    DEPENDENCY_TYPE_FS = 'FS'  # Finish-to-Start
    DEPENDENCY_TYPE_SS = 'SS'  # Start-to-Start
    DEPENDENCY_TYPE_FF = 'FF'  # Finish-to-Finish
    DEPENDENCY_TYPE_SF = 'SF'  # Start-to-Finish
    
    DEPENDENCY_TYPE_CHOICES = [
        (DEPENDENCY_TYPE_FS, _('Finish-to-Start')),
        (DEPENDENCY_TYPE_SS, _('Start-to-Start')),
        (DEPENDENCY_TYPE_FF, _('Finish-to-Finish')),
        (DEPENDENCY_TYPE_SF, _('Start-to-Finish')),
    ]
    
    predecessor = models.ForeignKey(
        GanttTask,
        on_delete=models.CASCADE,
        related_name='successor_dependencies',
        verbose_name=_('Predecessor')
    )
    successor = models.ForeignKey(
        GanttTask,
        on_delete=models.CASCADE,
        related_name='predecessor_dependencies',
        verbose_name=_('Successor')
    )
    type = models.CharField(
        max_length=2,
        choices=DEPENDENCY_TYPE_CHOICES,
        default=DEPENDENCY_TYPE_FS,
        verbose_name=_('Dependency Type')
    )
    lag = models.IntegerField(
        default=0,
        verbose_name=_('Lag (days)')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at')
    )
    
    class Meta:
        verbose_name = 'Зависимость Ганта'
        verbose_name_plural = 'Зависимости Ганта'
        db_table = 'gantt_dependencies'
        unique_together = [['predecessor', 'successor']]
        indexes = [
            models.Index(fields=['predecessor', 'successor']),
        ]
    
    def __str__(self):
        return f"{self.predecessor} -> {self.successor} ({self.type})"
