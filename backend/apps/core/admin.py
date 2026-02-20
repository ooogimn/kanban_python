"""
Admin configuration for core app.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User, Workspace, WorkspaceMember, ProjectMember, VerificationCode


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin для модели User."""
    list_display = ['username', 'email', 'telegram_username', 'is_staff', 'is_active', 'date_joined']
    list_filter = ['is_staff', 'is_active', 'date_joined']
    search_fields = ['username', 'email', 'telegram_username']
    fieldsets = BaseUserAdmin.fieldsets + (
        (_('Additional Info'), {'fields': ('role', 'avatar', 'timezone', 'settings', 'telegram_id', 'telegram_username', 'company')}),
    )


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    """Admin для модели Workspace."""
    list_display = ['name', 'slug', 'created_at']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(WorkspaceMember)
class WorkspaceMemberAdmin(admin.ModelAdmin):
    """Admin для модели WorkspaceMember."""
    list_display = ['user', 'workspace', 'role', 'joined_at']
    list_filter = ['role', 'joined_at']
    search_fields = ['user__username', 'workspace__name']


@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    """Admin для модели ProjectMember (участники проекта, в т.ч. теневые)."""
    list_display = ['display_name', 'project', 'user', 'role', 'hourly_rate']
    list_filter = ['role', 'project']
    search_fields = ['display_name', 'user__username', 'project__name']
    raw_id_fields = ['project', 'user']


@admin.register(VerificationCode)
class VerificationCodeAdmin(admin.ModelAdmin):
    """Admin для модели VerificationCode."""
    list_display = ['code', 'telegram_contact', 'username', 'is_verified', 'created_at', 'expires_at']
    list_filter = ['is_verified', 'created_at']
    search_fields = ['code', 'telegram_contact', 'username']
    readonly_fields = ['created_at', 'expires_at']
