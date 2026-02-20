"""
Сериализаторы HR (Contact). ContactDetailSerializer — HR-SPRINT 5 (Досье).
Employee/Department/Leave/Payroll — HR & Payroll Phase 1.
"""
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Contact,
    Department,
    EmployeeDocument,
    EmployeeProfile,
    LeaveRequest,
    PayrollRun,
    PayrollItem,
)


class ContactSerializer(serializers.ModelSerializer):
    """Сериализатор контакта HR. avatar_url — из user.avatar при наличии."""

    avatar_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Contact
        fields = [
            'id',
            'workspace',
            'user',
            'guarantor',
            'super_group',
            'group',
            'hr_role',
            'tariff_rate',
            'currency',
            'first_name',
            'last_name',
            'email',
            'phone',
            'avatar_url',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'avatar_url']

    def get_avatar_url(self, obj):
        if obj.user and obj.user.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.user.avatar.url)
            return obj.user.avatar.url
        return None


class ContactDetailSerializer(ContactSerializer):
    """
    Контакт с агрегатами для страницы Досье (HR-SPRINT 5).
    Часы считаются из TimeLog.duration_minutes → часы (duration_minutes / 60).
    """
    active_projects_count = serializers.SerializerMethodField(read_only=True)
    total_hours_worked = serializers.SerializerMethodField(read_only=True)
    current_month_hours = serializers.SerializerMethodField(read_only=True)
    projects = serializers.SerializerMethodField(read_only=True)

    class Meta(ContactSerializer.Meta):
        fields = ContactSerializer.Meta.fields + [
            'active_projects_count',
            'total_hours_worked',
            'current_month_hours',
            'projects',
        ]

    def get_active_projects_count(self, obj):
        from apps.core.models import ProjectMember
        return ProjectMember.objects.filter(contact=obj).count()

    def get_total_hours_worked(self, obj):
        if not obj.user_id:
            return 0.0
        from apps.timetracking.models import TimeLog
        agg = TimeLog.objects.filter(
            user_id=obj.user_id,
            workitem__project__workspace_id=obj.workspace_id,
        ).aggregate(total=Sum('duration_minutes'))
        minutes = agg.get('total') or 0
        return round(minutes / 60.0, 2)

    def get_current_month_hours(self, obj):
        if not obj.user_id:
            return 0.0
        from apps.timetracking.models import TimeLog
        now = timezone.now()
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        agg = TimeLog.objects.filter(
            user_id=obj.user_id,
            workitem__project__workspace_id=obj.workspace_id,
            started_at__gte=start,
            started_at__lte=now,
        ).aggregate(total=Sum('duration_minutes'))
        minutes = agg.get('total') or 0
        return round(minutes / 60.0, 2)

    def get_projects(self, obj):
        from apps.core.models import ProjectMember
        names = list(
            ProjectMember.objects.filter(contact=obj)
            .select_related('project')
            .values_list('project__name', flat=True)
        )
        return [n for n in names if n]


# --- HR & Payroll Phase 1 ---


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'workspace', 'name', 'head', 'parent', 'is_active']
        read_only_fields = ['id']


class EmployeeProfileSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = EmployeeProfile
        fields = [
            'id', 'member', 'department', 'job_title', 'status',
            'date_hired', 'date_terminated', 'employment_type', 'fte',
            'salary_mode', 'salary_amount', 'currency', 'payment_wallet',
            'settings', 'display_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'display_name']

    def get_display_name(self, obj):
        if obj.member and obj.member.user:
            return obj.member.user.get_full_name() or obj.member.user.username
        return f"Employee #{obj.pk}"


class LeaveRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'member', 'type', 'start_date', 'end_date',
            'status', 'approved_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'approved_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        instance = self.instance or LeaveRequest(**attrs)
        for k, v in attrs.items():
            setattr(instance, k, v)
        instance.clean()
        return attrs


class PayrollItemSerializer(serializers.ModelSerializer):
    employee_display = serializers.SerializerMethodField(read_only=True)
    job_title = serializers.SerializerMethodField(read_only=True)
    salary_rate = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PayrollItem
        fields = [
            'id', 'employee', 'employee_display', 'job_title', 'salary_rate',
            'gross_amount', 'net_amount', 'days_worked', 'hours_worked',
            'calculation_details', 'transaction', 'is_paid',
        ]
        read_only_fields = ['id', 'employee', 'employee_display', 'job_title', 'salary_rate',
                           'gross_amount', 'days_worked', 'hours_worked',
                           'calculation_details', 'transaction', 'is_paid']

    def get_employee_display(self, obj):
        if obj.employee and obj.employee.member and obj.employee.member.user:
            return obj.employee.member.user.get_full_name() or obj.employee.member.user.username
        return f"Employee #{obj.employee_id}"

    def get_job_title(self, obj):
        return (obj.employee.job_title or '') if obj.employee else ''

    def get_salary_rate(self, obj):
        if obj.employee and obj.employee.salary_amount is not None:
            return str(obj.employee.salary_amount)
        return None


class PayrollItemUpdateSerializer(serializers.ModelSerializer):
    """Для корректировки суммы (только net_amount)."""
    class Meta:
        model = PayrollItem
        fields = ['net_amount']


class PayrollRunSerializer(serializers.ModelSerializer):
    items = PayrollItemSerializer(many=True, read_only=True)

    class Meta:
        model = PayrollRun
        fields = [
            'id', 'workspace', 'period_start', 'period_end', 'total_amount',
            'currency', 'status', 'created_by', 'created_at', 'paid_at', 'items',
        ]
        read_only_fields = ['id', 'created_at', 'paid_at', 'items']


class PayrollRunCreateSerializer(serializers.Serializer):
    """Для создания PayrollRun через сервис."""
    workspace_id = serializers.IntegerField()
    period_start = serializers.DateField()
    period_end = serializers.DateField()
    currency = serializers.CharField(default='RUB', required=False)


class PayrollRunCommitSerializer(serializers.Serializer):
    """Для commit PayrollRun."""
    source_wallet_id = serializers.IntegerField()


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    """Сериализатор документа сотрудника."""
    file_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = EmployeeDocument
        fields = ['id', 'employee', 'doc_type', 'file', 'file_url', 'name', 'created_at']
        read_only_fields = ['id', 'created_at', 'file_url']

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class EmployeeDocumentCreateSerializer(serializers.ModelSerializer):
    """Для загрузки документа (file через multipart)."""
    class Meta:
        model = EmployeeDocument
        fields = ['employee', 'doc_type', 'file', 'name']
