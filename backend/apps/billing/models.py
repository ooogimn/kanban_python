"""
Billing models — Invoice, Subscription (HR Phase 0).
"""
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone

from apps.todo.models import Project
from apps.crm.models import Customer


class Subscription(models.Model):
    """
    Подписка владельца аккаунта (Директор).
    Пользователь с активной подпиской считается Директором для своих Workspaces.
    """
    PLAN_FREE = 'free'
    PLAN_PRO = 'pro'
    PLAN_ENTERPRISE = 'enterprise'

    PLAN_CHOICES = [
        (PLAN_FREE, _('Free')),
        (PLAN_PRO, _('Pro')),
        (PLAN_ENTERPRISE, _('Enterprise')),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='subscription',
        verbose_name=_('Owner (Director)'),
    )
    plan = models.CharField(
        max_length=20,
        choices=PLAN_CHOICES,
        default=PLAN_FREE,
        verbose_name=_('Plan (legacy)'),
        help_text=_('Дублирует plan_obj для совместимости'),
    )
    plan_obj = models.ForeignKey(
        'saas.Plan',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subscriptions',
        verbose_name=_('Plan (FK)'),
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name=_('Active'),
    )
    max_system_contacts = models.PositiveIntegerField(
        default=0,
        verbose_name=_('Max system contacts'),
        help_text=_('Лимит системных контактов по тарифу (0 = без лимита для enterprise)'),
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at'),
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_('Updated at'),
    )

    class Meta:
        verbose_name = 'Подписка'
        verbose_name_plural = 'Подписки'
        db_table = 'subscriptions'

    def __str__(self):
        return f"{self.user} — {self.plan}"


class Invoice(models.Model):
    """
    Счёт на оплату.
    
    Генерируется на основе TimeLog (выполненные работы).
    line_items — снимок строк (JSON) для неизменности при удалении логов.
    related_timelogs — M2M для пометки логов как «выставленных».
    """

    STATUS_DRAFT = 'draft'
    STATUS_SENT = 'sent'
    STATUS_PAID = 'paid'
    STATUS_CANCELLED = 'cancelled'

    STATUS_CHOICES = [
        (STATUS_DRAFT, _('Draft')),
        (STATUS_SENT, _('Sent')),
        (STATUS_PAID, _('Paid')),
        (STATUS_CANCELLED, _('Cancelled')),
    ]

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='invoices',
        verbose_name=_('Project'),
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='invoices',
        verbose_name=_('Customer'),
        help_text=_('Клиент (денормализация для истории)'),
    )
    number = models.CharField(
        max_length=32,
        unique=True,
        verbose_name=_('Invoice Number'),
        help_text=_('Формат INV-YYYY-XXXX'),
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        verbose_name=_('Status'),
    )
    date_issue = models.DateField(
        verbose_name=_('Issue Date'),
        default=timezone.now,
    )
    date_due = models.DateField(
        verbose_name=_('Due Date'),
    )
    amount_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0'),
        verbose_name=_('Total Amount'),
    )
    pdf_file = models.FileField(
        upload_to='invoices/%Y/%m/',
        null=True,
        blank=True,
        verbose_name=_('PDF File'),
    )
    line_items = models.JSONField(
        default=list,
        verbose_name=_('Line Items Snapshot'),
        help_text=_('Снимок строк счёта [{title, hours, rate, amount}, ...]'),
    )
    related_timelogs = models.ManyToManyField(
        'timetracking.TimeLog',
        related_name='invoices',
        blank=True,
        verbose_name=_('Related Time Logs'),
        help_text=_('Таймлоги, включённые в счёт'),
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at'),
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_('Updated at'),
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_invoices',
        verbose_name=_('Created by'),
    )

    class Meta:
        verbose_name = 'Счёт'
        verbose_name_plural = 'Счета'
        db_table = 'invoices'
        ordering = ['-date_issue', '-created_at']
        indexes = [
            models.Index(fields=['project']),
            models.Index(fields=['status']),
            models.Index(fields=['date_issue']),
        ]

    def __str__(self):
        return f"{self.number} — {self.project.name}"
