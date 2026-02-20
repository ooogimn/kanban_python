"""
AI Marketplace & Chat — каталог агентов, нанятые в workspace, история чата (SaaS Sprint 3).
"""
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class AiAgent(models.Model):
    """
    Каталог ИИ-агентов (Marketplace).
    """
    ROLE_HR = 'hr'
    ROLE_FINANCE = 'finance'
    ROLE_ASSISTANT = 'assistant'
    ROLE_MANAGER = 'manager'
    ROLE_ANALYST = 'analyst'
    ROLE_CHOICES = [
        (ROLE_HR, _('HR')),
        (ROLE_FINANCE, _('Finance')),
        (ROLE_ASSISTANT, _('Assistant')),
        (ROLE_MANAGER, _('Manager')),
        (ROLE_ANALYST, _('Analyst')),
    ]

    name = models.CharField(max_length=128, verbose_name=_('Name'))
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default=ROLE_ASSISTANT, verbose_name=_('Role (slug)'))
    description = models.TextField(blank=True, verbose_name=_('Description'))
    system_prompt = models.TextField(blank=True, verbose_name=_('System prompt (for LLM)'))
    avatar_url = models.URLField(blank=True, max_length=512, verbose_name=_('Avatar URL'))
    monthly_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        default=0,
        verbose_name=_('Monthly cost (accounting)'),
        help_text=_('Учётная стоимость агента в месяц для сравнения с людьми'),
    )
    is_active = models.BooleanField(default=True, verbose_name=_('Active'))
    is_free = models.BooleanField(default=False, verbose_name=_('Available on Free plan'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created at'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Updated at'))

    class Meta:
        verbose_name = _('AI Agent')
        verbose_name_plural = _('AI Agents')
        db_table = 'ai_agents'
        ordering = ['role', 'name']

    def __str__(self):
        return self.name


class WorkspaceAgent(models.Model):
    """
    Нанятый агент в workspace (привязка агента к workspace с учётом лимитов).
    """
    workspace = models.ForeignKey(
        'core.Workspace',
        on_delete=models.CASCADE,
        related_name='workspace_agents',
        verbose_name=_('Workspace'),
    )
    agent = models.ForeignKey(
        AiAgent,
        on_delete=models.CASCADE,
        related_name='workspace_agents',
        verbose_name=_('Agent'),
    )
    is_active = models.BooleanField(default=True, verbose_name=_('Active'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created at'))

    class Meta:
        verbose_name = _('Workspace Agent')
        verbose_name_plural = _('Workspace Agents')
        db_table = 'ai_workspace_agents'
        ordering = ['workspace', 'agent']
        constraints = [
            models.UniqueConstraint(fields=['workspace', 'agent'], name='ai_workspace_agent_unique'),
        ]

    def __str__(self):
        return f"{self.workspace.name} — {self.agent.name}"


class ChatMessage(models.Model):
    """
    Сообщение в чате с агентом.
    """
    ROLE_USER = 'user'
    ROLE_ASSISTANT = 'assistant'
    ROLE_CHOICES = [
        (ROLE_USER, _('User')),
        (ROLE_ASSISTANT, _('Assistant')),
    ]

    workspace_agent = models.ForeignKey(
        WorkspaceAgent,
        on_delete=models.CASCADE,
        related_name='messages',
        verbose_name=_('Workspace Agent'),
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ai_chat_messages',
        verbose_name=_('User'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, verbose_name=_('Role'))
    content = models.TextField(verbose_name=_('Content'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created at'))

    class Meta:
        verbose_name = _('Chat Message')
        verbose_name_plural = _('Chat Messages')
        db_table = 'ai_chat_messages'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.role}: {self.content[:50]}..."
