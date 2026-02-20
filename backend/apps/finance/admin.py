"""
Admin configuration for finance app — Immutable Ledger (Task 2.2).
"""
from django.contrib import admin

from .models import BankConnection, Category, Transaction, Wallet


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    """Admin для модели Transaction (ReadOnly — Immutable Ledger)."""

    list_display = [
        'id',
        'type',
        'status',
        'amount',
        'currency',
        'project',
        'workspace',
        'source_wallet',
        'destination_wallet',
        'related_workitem',
        'created_by',
        'created_at',
    ]
    list_filter = ['type', 'status', 'project', 'workspace']
    search_fields = ['description', 'project__name', 'related_workitem__title']
    readonly_fields = [
        'id',
        'type',
        'status',
        'amount',
        'currency',
        'project',
        'workspace',
        'source_wallet',
        'destination_wallet',
        'related_workitem',
        'related_timelog',
        'created_by',
        'created_at',
        'description',
        'receipt',
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'type', 'currency', 'balance', 'owner', 'workspace', 'is_active']
    search_fields = ['name']
    list_filter = ['type', 'currency', 'is_active']


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'type', 'pnl_group', 'workspace', 'parent']
    search_fields = ['name']
    list_filter = ['type', 'pnl_group', 'workspace']


@admin.register(BankConnection)
class BankConnectionAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'bank_type', 'workspace', 'linked_wallet', 'last_synced_at']
    list_filter = ['bank_type', 'workspace']
    search_fields = ['name']
