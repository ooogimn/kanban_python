"""
Finance models for Office Suite 360.
"""
import uuid

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _


class Wallet(models.Model):
    """Кошелёк / счёт — источник или приёмник средств."""

    TYPE_BANK = 'bank'
    TYPE_CASH = 'cash'
    TYPE_CRYPTO = 'crypto'
    TYPE_EWALLET = 'ewallet'

    TYPE_CHOICES = [
        (TYPE_BANK, _('Bank Account / Card')),
        (TYPE_CASH, _('Cash')),
        (TYPE_CRYPTO, _('Crypto Wallet')),
        (TYPE_EWALLET, _('E-Wallet')),
    ]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='wallets',
        help_text=_('Владелец (личный кошелек).')
    )
    workspace = models.ForeignKey(
        'core.Workspace',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='wallets',
        help_text=_('Workspace (бизнес-кошелек).')
    )
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_BANK)
    currency = models.CharField(max_length=3, default='RUB')
    balance = models.DecimalField(max_digits=19, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    last_reconciled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Кошелёк'
        verbose_name_plural = 'Кошельки'
        indexes = [
            models.Index(fields=['owner']),
            models.Index(fields=['workspace']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.currency})"

    def clean(self):
        if not self.owner and not self.workspace:
            raise ValidationError(_('Укажите владельца или workspace для кошелька.'))
        if self.owner and self.workspace:
            raise ValidationError(_('Нельзя выбрать и владельца, и workspace одновременно.'))
        if self.pk:
            old = Wallet.objects.get(pk=self.pk)
            if old.currency != self.currency:
                raise ValidationError(_('Нельзя менять валюту кошелька после создания.'))


class Category(models.Model):
    """Категория дохода/расхода."""

    TYPE_INCOME = 'income'
    TYPE_EXPENSE = 'expense'
    TYPE_CHOICES = [
        (TYPE_INCOME, _('Income')),
        (TYPE_EXPENSE, _('Expense')),
    ]

    PNL_REVENUE = 'revenue'
    PNL_COGS = 'cogs'
    PNL_OPEX = 'opex'
    PNL_TAX = 'tax'
    PNL_OTHER = 'other'
    PNL_DIVIDENDS = 'dividends'
    PNL_SALARY = 'salary'

    PNL_CHOICES = [
        (PNL_REVENUE, _('Revenue')),
        (PNL_COGS, _('COGS')),
        (PNL_OPEX, _('OPEX')),
        (PNL_TAX, _('Tax')),
        (PNL_OTHER, _('Other')),
        (PNL_DIVIDENDS, _('Dividends')),
        (PNL_SALARY, _('Salary / Payroll')),
    ]

    workspace = models.ForeignKey(
        'core.Workspace',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='finance_categories',
        help_text=_('Null = системная категория.')
    )
    name = models.CharField(max_length=120)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    pnl_group = models.CharField(max_length=20, choices=PNL_CHOICES, default=PNL_OTHER)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children'
    )
    color = models.CharField(max_length=7, default='#cccccc')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Категория (финансы)'
        verbose_name_plural = 'Категории (финансы)'
        unique_together = [('workspace', 'name')]
        indexes = [
            models.Index(fields=['workspace', 'type']),
        ]

    def __str__(self):
        return self.name


class BankConnection(models.Model):
    """Привязка кошелька к банковскому счёту (CSV/API интеграции)."""

    BANK_SBER = 'sber'
    BANK_TINKOFF = 'tinkoff'
    BANK_TOCHKA = 'tochka'
    BANK_MANUAL = 'manual_csv'
    BANK_OTHER = 'other'

    BANK_CHOICES = [
        (BANK_SBER, 'Sberbank'),
        (BANK_TINKOFF, 'Tinkoff'),
        (BANK_TOCHKA, 'Tochka'),
        (BANK_MANUAL, 'Manual CSV'),
        (BANK_OTHER, 'Other'),
    ]

    workspace = models.ForeignKey(
        'core.Workspace',
        on_delete=models.CASCADE,
        related_name='bank_connections'
    )
    name = models.CharField(max_length=255)
    bank_type = models.CharField(max_length=20, choices=BANK_CHOICES, default=BANK_MANUAL)
    linked_wallet = models.OneToOneField(
        Wallet,
        on_delete=models.PROTECT,
        related_name='bank_connection'
    )
    api_token = models.CharField(max_length=512, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Банковское подключение'
        verbose_name_plural = 'Банковские подключения'

    def __str__(self):
        return self.name


class Transaction(models.Model):
    """
    Финансовая транзакция (Immutable Ledger).

    Double-Entry ready: любое изменение баланса — новая запись.
    """

    TYPE_DEPOSIT = 'deposit'
    TYPE_SPEND = 'spend'
    TYPE_TRANSFER = 'transfer'
    TYPE_HOLD = 'hold'
    TYPE_RELEASE = 'release'
    TYPE_ADJUSTMENT = 'adjustment'

    TYPE_CHOICES = [
        (TYPE_DEPOSIT, _('Deposit')),
        (TYPE_SPEND, _('Spend')),
        (TYPE_TRANSFER, _('Transfer')),
        (TYPE_HOLD, _('Hold')),
        (TYPE_RELEASE, _('Release')),
        (TYPE_ADJUSTMENT, _('Adjustment')),
    ]

    STATUS_PENDING = 'pending'
    STATUS_COMPLETED = 'completed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_PENDING, _('Pending')),
        (STATUS_COMPLETED, _('Completed')),
        (STATUS_CANCELLED, _('Cancelled')),
    ]

    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_COMPLETED)
    amount = models.DecimalField(max_digits=19, decimal_places=2, help_text=_('Всегда положительное число'))
    currency = models.CharField(max_length=3, default='RUB')
    description = models.TextField(blank=True)

    source_wallet = models.ForeignKey(
        Wallet,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='transactions_from'
    )
    destination_wallet = models.ForeignKey(
        Wallet,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='transactions_to'
    )

    project = models.ForeignKey(
        'todo.Project',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='transactions'
    )
    related_workitem = models.ForeignKey(
        'todo.WorkItem',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='finance_transactions'
    )
    related_timelog = models.ForeignKey(
        'timetracking.TimeLog',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='finance_transactions'
    )
    workspace = models.ForeignKey(
        'core.Workspace',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='transactions'
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='transactions'
    )
    counterparty = models.ForeignKey(
        'crm.Customer',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='transactions'
    )
    payroll_contact = models.ForeignKey(
        'hr.Contact',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payroll_transactions',
        help_text=_('Устаревшее поле для payroll, оставлено для совместимости.')
    )

    receipt = models.FileField(upload_to='protected/receipts/%Y/%m/', null=True, blank=True)
    transfer_group_id = models.UUIDField(null=True, blank=True, editable=False)

    evidence_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    evidence_object_id = models.CharField(max_length=64, null=True, blank=True)
    evidence_object = GenericForeignKey('evidence_content_type', 'evidence_object_id')

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_transactions'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Транзакция'
        verbose_name_plural = 'Транзакции'
        db_table = 'transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['project', 'type']),
            models.Index(fields=['related_workitem']),
            models.Index(fields=['related_timelog']),
            models.Index(fields=['created_at']),
            models.Index(fields=['source_wallet']),
            models.Index(fields=['destination_wallet']),
            models.Index(fields=['transfer_group_id']),
        ]

    def __str__(self):
        project_name = self.project.name if self.project else '—'
        return f"{self.type} {self.amount} ({project_name})"

    def save(self, *args, **kwargs):
        """
        Immutability: запрет на изменение существующих транзакций.
        """
        if self.pk is not None:
            raise ValueError(
                "Транзакции immutable — изменение запрещено. "
                "Создайте новую транзакцию для корректировки."
            )
        super().save(*args, **kwargs)
