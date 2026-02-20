"""
HR admin.
"""
from django.contrib import admin
from .models import Contact, Invitation, Department, EmployeeDocument, EmployeeProfile, LeaveRequest, PayrollRun, PayrollItem


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ['email', 'contact', 'workspace', 'status', 'expires_at', 'created_at']
    list_filter = ['status']
    search_fields = ['email']
    raw_id_fields = ['workspace', 'sender', 'contact']


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    """Admin для контактов HR."""

    list_display = [
        'id', 'last_name', 'first_name', 'workspace', 'super_group', 'group',
        'user', 'guarantor', 'email', 'tariff_rate', 'currency',
    ]
    list_filter = ['super_group', 'group', 'workspace']
    search_fields = ['first_name', 'last_name', 'email', 'phone']
    raw_id_fields = ['workspace', 'user', 'guarantor']
    list_editable = []  # при необходимости можно вынести часть полей сюда


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'workspace', 'head', 'parent', 'is_active']
    list_filter = ['workspace', 'is_active']
    search_fields = ['name']
    raw_id_fields = ['workspace', 'head', 'parent']


@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'member', 'department', 'job_title', 'status', 'employment_type',
        'salary_mode', 'salary_amount', 'currency', 'payment_wallet',
    ]
    list_filter = ['status', 'employment_type', 'salary_mode']
    search_fields = ['job_title']
    raw_id_fields = ['member', 'department', 'payment_wallet']


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ['id', 'member', 'type', 'start_date', 'end_date', 'status', 'approved_by']
    list_filter = ['type', 'status']
    raw_id_fields = ['member', 'approved_by']


@admin.register(PayrollRun)
class PayrollRunAdmin(admin.ModelAdmin):
    list_display = ['id', 'workspace', 'period_start', 'period_end', 'total_amount', 'currency', 'status', 'created_by', 'paid_at']
    list_filter = ['status']
    raw_id_fields = ['workspace', 'created_by']


@admin.register(PayrollItem)
class PayrollItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'payroll_run', 'employee', 'gross_amount', 'net_amount', 'is_paid']
    list_filter = ['is_paid']
    raw_id_fields = ['payroll_run', 'employee', 'transaction']


@admin.register(EmployeeDocument)
class EmployeeDocumentAdmin(admin.ModelAdmin):
    list_display = ['id', 'employee', 'doc_type', 'name', 'created_at']
    list_filter = ['doc_type']
    raw_id_fields = ['employee']
