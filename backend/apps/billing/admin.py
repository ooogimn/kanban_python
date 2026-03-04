"""
Billing admin.
"""
from django.contrib import admin
from .models import (
    Invoice,
    Subscription,
    BillingAccount,
    PlanVersion,
    BillingSubscription,
    SubscriptionItem,
    UsageMeter,
    UsageRecord,
    EntitlementOverride,
    PaymentTransaction,
    PaymentWebhookEvent,
)


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    """Admin для подписки (Директор)."""
    list_display = ['user', 'plan', 'is_active', 'max_system_contacts', 'updated_at']
    list_filter = ['plan', 'is_active']
    search_fields = ['user__username', 'user__email']
    raw_id_fields = ['user']


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    """Admin для Invoice."""

    list_display = ['number', 'project', 'customer', 'status', 'amount_total', 'date_issue']
    list_filter = ['status', 'date_issue']
    search_fields = ['number', 'project__name', 'customer__name']
    readonly_fields = ['number', 'line_items', 'created_at', 'updated_at']
    raw_id_fields = ['project', 'customer', 'created_by']


@admin.register(BillingAccount)
class BillingAccountAdmin(admin.ModelAdmin):
    list_display = ['workspace', 'owner', 'status', 'currency', 'updated_at']
    list_filter = ['status', 'currency']
    search_fields = ['workspace__name', 'owner__username', 'owner__email']
    raw_id_fields = ['workspace', 'owner']


@admin.register(PlanVersion)
class PlanVersionAdmin(admin.ModelAdmin):
    list_display = ['code', 'version', 'name', 'interval', 'price', 'currency', 'is_active']
    list_filter = ['interval', 'currency', 'is_active']
    search_fields = ['code', 'name']
    raw_id_fields = ['saas_plan']


class SubscriptionItemInline(admin.TabularInline):
    model = SubscriptionItem
    extra = 0


@admin.register(BillingSubscription)
class BillingSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['id', 'account', 'plan_version', 'status', 'current_period_end', 'cancel_at_period_end']
    list_filter = ['status', 'cancel_at_period_end', 'provider']
    search_fields = ['account__workspace__name', 'provider_subscription_id', 'plan_version__code']
    raw_id_fields = ['account', 'plan_version']
    inlines = [SubscriptionItemInline]


@admin.register(UsageMeter)
class UsageMeterAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'unit', 'aggregation', 'is_billable', 'is_active']
    list_filter = ['aggregation', 'is_billable', 'is_active']
    search_fields = ['code', 'name']


@admin.register(UsageRecord)
class UsageRecordAdmin(admin.ModelAdmin):
    list_display = ['id', 'account', 'meter', 'quantity', 'occurred_at', 'source']
    list_filter = ['meter', 'source']
    search_fields = ['account__workspace__name', 'meter__code', 'idempotency_key']
    raw_id_fields = ['account', 'meter']


@admin.register(EntitlementOverride)
class EntitlementOverrideAdmin(admin.ModelAdmin):
    list_display = ['id', 'account', 'key', 'is_enabled', 'expires_at', 'created_at']
    list_filter = ['is_enabled', 'expires_at']
    search_fields = ['account__workspace__name', 'key', 'reason']
    raw_id_fields = ['account', 'created_by']


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ['id', 'provider', 'provider_payment_id', 'account', 'status', 'amount', 'currency', 'created_at']
    list_filter = ['provider', 'status', 'currency']
    search_fields = ['provider_payment_id', 'idempotency_key', 'description', 'account__workspace__name']
    raw_id_fields = ['account', 'subscription', 'invoice']


@admin.register(PaymentWebhookEvent)
class PaymentWebhookEventAdmin(admin.ModelAdmin):
    list_display = ['id', 'provider', 'event_type', 'event_id', 'status', 'created_at', 'processed_at']
    list_filter = ['provider', 'status', 'event_type']
    search_fields = ['event_id', 'event_type', 'error_message']
    readonly_fields = ['payload', 'created_at', 'updated_at']
