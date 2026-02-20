"""
Billing admin.
"""
from django.contrib import admin
from .models import Invoice, Subscription


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
