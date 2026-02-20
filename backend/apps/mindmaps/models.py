"""
Mind Maps models.
"""
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class MindMap(models.Model):
    """
    Интерактивная ментальная карта. Структура узлов и рёбер хранится в JSON (ReactFlow).
    Привязка к workspace / project / workitem опциональна.
    """
    title = models.CharField(max_length=255, verbose_name=_('Title'))
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='mindmaps',
        verbose_name=_('Owner'),
    )
    workspace = models.ForeignKey(
        'core.Workspace',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mindmaps',
        verbose_name=_('Workspace'),
    )
    project = models.ForeignKey(
        'todo.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mindmaps',
        verbose_name=_('Project'),
    )
    related_workitem = models.ForeignKey(
        'todo.WorkItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mindmaps',
        verbose_name=_('Related Task'),
    )
    nodes = models.JSONField(default=list, blank=True, verbose_name=_('Nodes'))
    edges = models.JSONField(default=list, blank=True, verbose_name=_('Edges'))
    is_personal = models.BooleanField(default=False, verbose_name=_('Personal'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created at'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Updated at'))

    class Meta:
        verbose_name = 'Карта мыслей'
        verbose_name_plural = 'Карты мыслей'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['workspace']),
            models.Index(fields=['project']),
            models.Index(fields=['related_workitem']),
            models.Index(fields=['owner', 'is_personal']),
        ]

    def __str__(self):
        return self.title
