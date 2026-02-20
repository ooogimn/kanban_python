"""
Admin configuration for notifications app.
"""
from django.contrib import admin
from .models import Notification, AuditLog


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Admin для модели Notification."""
    list_display = ['type', 'user', 'is_read', 'related_workitem', 'created_at']
    list_filter = ['type', 'read_at', 'created_at']
    search_fields = ['message', 'user__username']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Admin для модели AuditLog."""
    list_display = ['action', 'model_name', 'object_id', 'user', 'timestamp']
    list_filter = ['action', 'model_name', 'timestamp']
    search_fields = ['model_name', 'user__username']
    date_hierarchy = 'timestamp'
    readonly_fields = ['timestamp']
