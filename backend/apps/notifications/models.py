"""
Notifications models for Office Suite 360.
"""
from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.core.models import User


class Notification(models.Model):
    """Уведомление."""
    
    TYPE_TASK_ASSIGNED = 'task_assigned'
    TYPE_TASK_UPDATED = 'task_updated'
    TYPE_TASK_COMMENTED = 'task_commented'
    TYPE_DEADLINE_APPROACHING = 'deadline_approaching'
    TYPE_DEADLINE_PASSED = 'deadline_passed'
    TYPE_PROJECT_UPDATED = 'project_updated'
    TYPE_BUDGET_ALERT = 'budget_alert'
    
    TYPE_CHOICES = [
        (TYPE_TASK_ASSIGNED, _('Task Assigned')),
        (TYPE_TASK_UPDATED, _('Task Updated')),
        (TYPE_TASK_COMMENTED, _('Task Commented')),
        (TYPE_DEADLINE_APPROACHING, _('Deadline Approaching')),
        (TYPE_DEADLINE_PASSED, _('Deadline Passed')),
        (TYPE_PROJECT_UPDATED, _('Project Updated')),
        (TYPE_BUDGET_ALERT, _('Budget Alert')),
    ]
    
    type = models.CharField(
        max_length=50,
        choices=TYPE_CHOICES,
        verbose_name=_('Type')
    )
    message = models.TextField(
        verbose_name=_('Message')
    )
    read_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Read At')
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name=_('User')
    )
    related_workitem = models.ForeignKey(
        'todo.WorkItem',
        on_delete=models.CASCADE,
        related_name='notifications',
        null=True,
        blank=True,
        verbose_name=_('Related Work Item')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at')
    )
    
    class Meta:
        verbose_name = 'Уведомление'
        verbose_name_plural = 'Уведомления'
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'read_at']),
            models.Index(fields=['type', 'created_at']),
            models.Index(fields=['related_workitem']),
        ]
    
    def __str__(self):
        return f"{self.type} - {self.user}"
    
    @property
    def is_read(self):
        """Проверка, прочитано ли уведомление."""
        return self.read_at is not None


class AuditLog(models.Model):
    """Аудит лог."""
    
    ACTION_CREATE = 'create'
    ACTION_UPDATE = 'update'
    ACTION_DELETE = 'delete'
    
    ACTION_CHOICES = [
        (ACTION_CREATE, _('Create')),
        (ACTION_UPDATE, _('Update')),
        (ACTION_DELETE, _('Delete')),
    ]
    
    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES,
        verbose_name=_('Action')
    )
    model_name = models.CharField(
        max_length=100,
        verbose_name=_('Model Name')
    )
    object_id = models.PositiveIntegerField(
        verbose_name=_('Object ID')
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs',
        verbose_name=_('User')
    )
    changes = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Changes')
    )
    timestamp = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Timestamp')
    )
    
    class Meta:
        verbose_name = 'Журнал аудита'
        verbose_name_plural = 'Журналы аудита'
        db_table = 'audit_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['model_name', 'object_id']),
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['action', 'timestamp']),
        ]
    
    def __str__(self):
        return f"{self.action} {self.model_name}#{self.object_id} by {self.user}"
