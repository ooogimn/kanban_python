"""
Admin configuration for crm app.
"""
from django.contrib import admin
from .models import Company


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    """Admin для модели Company."""
    list_display = ['name', 'short_name', 'type', 'inn', 'email', 'is_active', 'created_at']
    list_filter = ['type', 'is_active', 'created_at']
    search_fields = ['name', 'short_name', 'inn', 'email']
    readonly_fields = ['created_at', 'updated_at']
