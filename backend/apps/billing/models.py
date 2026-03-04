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


class BillingAccount(models.Model):
    """
    Биллинг-аккаунт уровня workspace (tenant-level).
    Не заменяет legacy-подписку, а добавляется рядом для поэтапной миграции.
    """
    STATUS_ACTIVE = 'active'
    STATUS_SUSPENDED = 'suspended'
    STATUS_ARCHIVED = 'archived'

    STATUS_CHOICES = [
        (STATUS_ACTIVE, _('Active')),
        (STATUS_SUSPENDED, _('Suspended')),
        (STATUS_ARCHIVED, _('Archived')),
    ]

    workspace = models.OneToOneField(
        'core.Workspace',
        on_delete=models.CASCADE,
        related_name='billing_account',
        verbose_name=_('Workspace'),
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='billing_accounts',
        verbose_name=_('Owner'),
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
        verbose_name=_('Status'),
    )
    currency = models.CharField(
        max_length=6,
        default='RUB',
        verbose_name=_('Currency'),
    )
    timezone = models.CharField(
        max_length=64,
        default='Europe/Moscow',
        verbose_name=_('Timezone'),
    )
    tax_profile = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Tax profile'),
    )
    meta = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Meta'),
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
        verbose_name = _('Billing account')
        verbose_name_plural = _('Billing accounts')
        db_table = 'billing_accounts'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['owner']),
        ]

    def __str__(self):
        return f"{self.workspace} ({self.status})"


class PlanVersion(models.Model):
    """
    Версия тарифа для биллинга v2.
    Позволяет менять тарифы без переписывания истории подписок.
    """
    INTERVAL_MONTH = 'month'
    INTERVAL_YEAR = 'year'

    INTERVAL_CHOICES = [
        (INTERVAL_MONTH, _('Month')),
        (INTERVAL_YEAR, _('Year')),
    ]

    code = models.CharField(
        max_length=64,
        verbose_name=_('Code'),
        help_text=_('Внутренний код тарифа, например pro_monthly'),
    )
    name = models.CharField(
        max_length=128,
        verbose_name=_('Name'),
    )
    version = models.PositiveIntegerField(
        default=1,
        verbose_name=_('Version'),
    )
    interval = models.CharField(
        max_length=10,
        choices=INTERVAL_CHOICES,
        default=INTERVAL_MONTH,
        verbose_name=_('Billing interval'),
    )
    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0'),
        verbose_name=_('Price'),
    )
    currency = models.CharField(
        max_length=6,
        default='RUB',
        verbose_name=_('Currency'),
    )
    limits_schema = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Limits schema'),
    )
    features_schema = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Features schema'),
    )
    saas_plan = models.ForeignKey(
        'saas.Plan',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='billing_versions',
        verbose_name=_('Legacy SaaS plan'),
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name=_('Active'),
    )
    effective_from = models.DateTimeField(
        default=timezone.now,
        verbose_name=_('Effective from'),
    )
    effective_to = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Effective to'),
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
        verbose_name = _('Plan version')
        verbose_name_plural = _('Plan versions')
        db_table = 'billing_plan_versions'
        ordering = ['code', '-version']
        constraints = [
            models.UniqueConstraint(
                fields=['code', 'version'],
                name='unique_plan_version_per_code',
            ),
        ]
        indexes = [
            models.Index(fields=['code', 'is_active']),
        ]

    def __str__(self):
        return f"{self.code} v{self.version}"


class BillingSubscription(models.Model):
    """
    Подписка v2 для BillingAccount.
    """
    STATUS_TRIALING = 'trialing'
    STATUS_ACTIVE = 'active'
    STATUS_PAST_DUE = 'past_due'
    STATUS_SUSPENDED = 'suspended'
    STATUS_CANCELED = 'canceled'
    STATUS_EXPIRED = 'expired'
    STATUS_MANUAL_HOLD = 'manual_hold'

    STATUS_CHOICES = [
        (STATUS_TRIALING, _('Trialing')),
        (STATUS_ACTIVE, _('Active')),
        (STATUS_PAST_DUE, _('Past due')),
        (STATUS_SUSPENDED, _('Suspended')),
        (STATUS_CANCELED, _('Canceled')),
        (STATUS_EXPIRED, _('Expired')),
        (STATUS_MANUAL_HOLD, _('Manual hold')),
    ]

    account = models.ForeignKey(
        BillingAccount,
        on_delete=models.CASCADE,
        related_name='subscriptions_v2',
        verbose_name=_('Billing account'),
    )
    plan_version = models.ForeignKey(
        PlanVersion,
        on_delete=models.PROTECT,
        related_name='subscriptions',
        verbose_name=_('Plan version'),
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_TRIALING,
        verbose_name=_('Status'),
    )
    current_period_start = models.DateTimeField(
        verbose_name=_('Current period start'),
    )
    current_period_end = models.DateTimeField(
        verbose_name=_('Current period end'),
    )
    trial_end = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Trial end'),
    )
    cancel_at_period_end = models.BooleanField(
        default=False,
        verbose_name=_('Cancel at period end'),
    )
    canceled_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Canceled at'),
    )
    provider = models.CharField(
        max_length=32,
        blank=True,
        default='',
        verbose_name=_('Payment provider'),
    )
    provider_subscription_id = models.CharField(
        max_length=255,
        blank=True,
        default='',
        verbose_name=_('Provider subscription id'),
    )
    meta = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Meta'),
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
        verbose_name = _('Billing subscription')
        verbose_name_plural = _('Billing subscriptions')
        db_table = 'billing_subscriptions_v2'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['account', 'status']),
            models.Index(fields=['current_period_end']),
        ]

    def __str__(self):
        return f"{self.account_id}: {self.plan_version} [{self.status}]"


class SubscriptionItem(models.Model):
    """
    Позиции подписки: базовый план и/или add-ons.
    """
    ITEM_PLAN = 'plan'
    ITEM_ADDON = 'addon'

    ITEM_CHOICES = [
        (ITEM_PLAN, _('Plan')),
        (ITEM_ADDON, _('Addon')),
    ]

    subscription = models.ForeignKey(
        BillingSubscription,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name=_('Subscription'),
    )
    item_type = models.CharField(
        max_length=16,
        choices=ITEM_CHOICES,
        default=ITEM_PLAN,
        verbose_name=_('Item type'),
    )
    code = models.CharField(
        max_length=64,
        verbose_name=_('Code'),
    )
    quantity = models.PositiveIntegerField(
        default=1,
        verbose_name=_('Quantity'),
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0'),
        verbose_name=_('Unit price'),
    )
    included_units = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal('0'),
        verbose_name=_('Included units'),
    )
    overage_price = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        default=Decimal('0'),
        verbose_name=_('Overage price'),
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name=_('Active'),
    )
    meta = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Meta'),
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
        verbose_name = _('Subscription item')
        verbose_name_plural = _('Subscription items')
        db_table = 'billing_subscription_items'
        indexes = [
            models.Index(fields=['subscription', 'item_type']),
            models.Index(fields=['code', 'is_active']),
        ]

    def __str__(self):
        return f"{self.subscription_id}: {self.code} x{self.quantity}"


class UsageMeter(models.Model):
    """
    Каталог метрик потребления (что и в каких единицах считаем).
    """
    AGG_SUM = 'sum'
    AGG_COUNT = 'count'
    AGG_MAX = 'max'

    AGG_CHOICES = [
        (AGG_SUM, _('Sum')),
        (AGG_COUNT, _('Count')),
        (AGG_MAX, _('Max')),
    ]

    code = models.CharField(
        max_length=64,
        unique=True,
        verbose_name=_('Code'),
    )
    name = models.CharField(
        max_length=128,
        verbose_name=_('Name'),
    )
    unit = models.CharField(
        max_length=32,
        verbose_name=_('Unit'),
        help_text=_('Пример: count, gb, minute, request'),
    )
    aggregation = models.CharField(
        max_length=16,
        choices=AGG_CHOICES,
        default=AGG_SUM,
        verbose_name=_('Aggregation'),
    )
    is_billable = models.BooleanField(
        default=True,
        verbose_name=_('Billable'),
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name=_('Active'),
    )
    meta = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Meta'),
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
        verbose_name = _('Usage meter')
        verbose_name_plural = _('Usage meters')
        db_table = 'billing_usage_meters'
        ordering = ['code']
        indexes = [
            models.Index(fields=['is_active', 'is_billable']),
        ]

    def __str__(self):
        return self.code


class UsageRecord(models.Model):
    """
    Сырое событие потребления ресурса (event-level metering).
    """
    account = models.ForeignKey(
        BillingAccount,
        on_delete=models.CASCADE,
        related_name='usage_records',
        verbose_name=_('Billing account'),
    )
    meter = models.ForeignKey(
        UsageMeter,
        on_delete=models.PROTECT,
        related_name='records',
        verbose_name=_('Meter'),
    )
    quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal('0'),
        verbose_name=_('Quantity'),
    )
    occurred_at = models.DateTimeField(
        default=timezone.now,
        verbose_name=_('Occurred at'),
    )
    source = models.CharField(
        max_length=64,
        blank=True,
        default='',
        verbose_name=_('Source'),
    )
    idempotency_key = models.CharField(
        max_length=128,
        blank=True,
        default='',
        verbose_name=_('Idempotency key'),
    )
    meta = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Meta'),
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at'),
    )

    class Meta:
        verbose_name = _('Usage record')
        verbose_name_plural = _('Usage records')
        db_table = 'billing_usage_records'
        ordering = ['-occurred_at', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['account', 'meter', 'idempotency_key'],
                condition=~models.Q(idempotency_key=''),
                name='unique_usage_record_idempotency',
            ),
        ]
        indexes = [
            models.Index(fields=['account', 'meter', 'occurred_at']),
            models.Index(fields=['source']),
        ]

    def __str__(self):
        return f"{self.account_id}:{self.meter.code}={self.quantity}"


class EntitlementOverride(models.Model):
    """
    Ручное переопределение прав/лимитов аккаунта администратором.
    """
    account = models.ForeignKey(
        BillingAccount,
        on_delete=models.CASCADE,
        related_name='entitlement_overrides',
        verbose_name=_('Billing account'),
    )
    key = models.CharField(
        max_length=128,
        verbose_name=_('Key'),
        help_text=_('Пример: features.payroll, limits.max_ai_agents'),
    )
    value = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Value'),
    )
    is_enabled = models.BooleanField(
        default=True,
        verbose_name=_('Enabled'),
    )
    reason = models.CharField(
        max_length=255,
        blank=True,
        default='',
        verbose_name=_('Reason'),
    )
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Expires at'),
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_entitlement_overrides',
        verbose_name=_('Created by'),
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
        verbose_name = _('Entitlement override')
        verbose_name_plural = _('Entitlement overrides')
        db_table = 'billing_entitlement_overrides'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['account', 'key', 'is_enabled']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f"{self.account_id}:{self.key}"


class PaymentTransaction(models.Model):
    """
    Платежная транзакция (R2): создание intent и последующий жизненный цикл.
    """
    PROVIDER_YOOKASSA = 'yookassa'
    PROVIDER_STRIPE = 'stripe'
    PROVIDER_ROBOKASSA = 'robokassa'
    PROVIDER_MANUAL = 'manual'

    PROVIDER_CHOICES = [
        (PROVIDER_YOOKASSA, _('YooKassa')),
        (PROVIDER_STRIPE, _('Stripe')),
        (PROVIDER_ROBOKASSA, _('Robokassa')),
        (PROVIDER_MANUAL, _('Manual')),
    ]

    STATUS_PENDING = 'pending'
    STATUS_REQUIRES_ACTION = 'requires_action'
    STATUS_WAITING_CAPTURE = 'waiting_for_capture'
    STATUS_SUCCEEDED = 'succeeded'
    STATUS_CANCELED = 'canceled'
    STATUS_FAILED = 'failed'
    STATUS_REFUNDED = 'refunded'

    STATUS_CHOICES = [
        (STATUS_PENDING, _('Pending')),
        (STATUS_REQUIRES_ACTION, _('Requires action')),
        (STATUS_WAITING_CAPTURE, _('Waiting capture')),
        (STATUS_SUCCEEDED, _('Succeeded')),
        (STATUS_CANCELED, _('Canceled')),
        (STATUS_FAILED, _('Failed')),
        (STATUS_REFUNDED, _('Refunded')),
    ]

    account = models.ForeignKey(
        BillingAccount,
        on_delete=models.CASCADE,
        related_name='payment_transactions',
        verbose_name=_('Billing account'),
    )
    subscription = models.ForeignKey(
        BillingSubscription,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payment_transactions',
        verbose_name=_('Billing subscription'),
    )
    invoice = models.ForeignKey(
        'Invoice',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payment_transactions',
        verbose_name=_('Invoice'),
    )
    provider = models.CharField(
        max_length=32,
        choices=PROVIDER_CHOICES,
        default=PROVIDER_YOOKASSA,
        verbose_name=_('Provider'),
    )
    provider_payment_id = models.CharField(
        max_length=255,
        blank=True,
        default='',
        verbose_name=_('Provider payment id'),
    )
    idempotency_key = models.CharField(
        max_length=128,
        blank=True,
        default='',
        verbose_name=_('Idempotency key'),
    )
    status = models.CharField(
        max_length=32,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        verbose_name=_('Status'),
    )
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0'),
        verbose_name=_('Amount'),
    )
    currency = models.CharField(
        max_length=6,
        default='RUB',
        verbose_name=_('Currency'),
    )
    description = models.CharField(
        max_length=255,
        blank=True,
        default='',
        verbose_name=_('Description'),
    )
    confirmation_url = models.URLField(
        blank=True,
        default='',
        verbose_name=_('Confirmation URL'),
    )
    raw_response = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Raw response'),
    )
    meta = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Meta'),
    )
    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Paid at'),
    )
    canceled_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Canceled at'),
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
        verbose_name = _('Payment transaction')
        verbose_name_plural = _('Payment transactions')
        db_table = 'billing_payment_transactions'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'provider_payment_id'],
                condition=~models.Q(provider_payment_id=''),
                name='unique_provider_payment_id',
            ),
            models.UniqueConstraint(
                fields=['account', 'provider', 'idempotency_key'],
                condition=~models.Q(idempotency_key=''),
                name='unique_account_provider_idempotency',
            ),
        ]
        indexes = [
            models.Index(fields=['account', 'status']),
            models.Index(fields=['provider', 'status']),
        ]

    def __str__(self):
        return f"{self.provider}:{self.provider_payment_id or self.id} [{self.status}]"


class PaymentWebhookEvent(models.Model):
    """
    Сырые webhook-события от платежных провайдеров (идемпотентная обработка).
    """
    STATUS_PENDING = 'pending'
    STATUS_PROCESSED = 'processed'
    STATUS_FAILED = 'failed'

    STATUS_CHOICES = [
        (STATUS_PENDING, _('Pending')),
        (STATUS_PROCESSED, _('Processed')),
        (STATUS_FAILED, _('Failed')),
    ]

    provider = models.CharField(
        max_length=32,
        default=PaymentTransaction.PROVIDER_YOOKASSA,
        verbose_name=_('Provider'),
    )
    event_type = models.CharField(
        max_length=64,
        blank=True,
        default='',
        verbose_name=_('Event type'),
    )
    event_id = models.CharField(
        max_length=255,
        verbose_name=_('Event id'),
    )
    payload = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Payload'),
    )
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        verbose_name=_('Status'),
    )
    error_message = models.TextField(
        blank=True,
        default='',
        verbose_name=_('Error message'),
    )
    processed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Processed at'),
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
        verbose_name = _('Payment webhook event')
        verbose_name_plural = _('Payment webhook events')
        db_table = 'billing_payment_webhook_events'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'event_id'],
                name='unique_provider_event_id',
            ),
        ]
        indexes = [
            models.Index(fields=['provider', 'status']),
            models.Index(fields=['event_type']),
        ]

    def __str__(self):
        return f"{self.provider}:{self.event_type}:{self.event_id}"


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
