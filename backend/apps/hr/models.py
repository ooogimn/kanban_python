"""
HR models — Contact (Phase 1), Invitation (HR-SPRINT 3), Employee/Department/Payroll (HR Phase 1).
"""
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class Contact(models.Model):
    """
    Контакт — любой человек (сотрудник, клиент, подрядчик) в рамках Workspace.
    Центральная сущность HR-слоя для биллинга и управления персоналом.
    """
    SUPER_GROUP_SYSTEM = 'SYSTEM'
    SUPER_GROUP_NON_SYSTEM = 'NON_SYSTEM'
    SUPER_GROUP_CHOICES = [
        (SUPER_GROUP_SYSTEM, _('System (Staff)')),
        (SUPER_GROUP_NON_SYSTEM, _('Non-system (External)')),
    ]

    # Справочные значения для group (staff, employee, client и т.д.)
    workspace = models.ForeignKey(
        'core.Workspace',
        on_delete=models.CASCADE,
        related_name='contacts',
        verbose_name=_('Workspace'),
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hr_contacts',
        verbose_name=_('User'),
        help_text=_('Если заполнено — контакт имеет системный аккаунт'),
    )
    guarantor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='guaranteed_contacts',
        verbose_name=_('Guarantor'),
        help_text=_('Поручитель v1 — действует от имени контакта'),
    )
    super_group = models.CharField(
        max_length=20,
        choices=SUPER_GROUP_CHOICES,
        default=SUPER_GROUP_SYSTEM,
        verbose_name=_('Super group'),
    )
    group = models.CharField(
        max_length=64,
        default='staff',
        verbose_name=_('Group'),
        help_text=_('Категория: staff, employee, client, contractor…'),
    )
    hr_role = models.CharField(
        max_length=64,
        blank=True,
        verbose_name=_('HR role'),
        help_text=_('Организационная роль: Worker, Lead, Team Lead…'),
    )
    # Финансы
    tariff_rate = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        default=None,
        verbose_name=_('Tariff rate'),
    )
    currency = models.CharField(
        max_length=3,
        blank=True,
        default='RUB',
        verbose_name=_('Currency'),
    )
    # Контактные данные
    first_name = models.CharField(
        max_length=128,
        blank=True,
        verbose_name=_('First name'),
    )
    last_name = models.CharField(
        max_length=128,
        blank=True,
        verbose_name=_('Last name'),
    )
    email = models.EmailField(
        blank=True,
        verbose_name=_('Email'),
    )
    phone = models.CharField(
        max_length=32,
        blank=True,
        verbose_name=_('Phone'),
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
        verbose_name = 'Контакт'
        verbose_name_plural = 'Контакты'
        db_table = 'hr_contacts'
        ordering = ['super_group', 'last_name', 'first_name']
        indexes = [
            models.Index(fields=['workspace']),
            models.Index(fields=['super_group']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        name = f"{self.last_name} {self.first_name}".strip() or self.email or f"Contact #{self.pk}"
        return name


class Invitation(models.Model):
    """
    Приглашение теневого контакта в систему. Срок действия 48 часов.
    После принятия: contact.user = user, добавление в WorkspaceMember, синхронизация ProjectMember.
    """
    STATUS_PENDING = 'PENDING'
    STATUS_ACCEPTED = 'ACCEPTED'
    STATUS_EXPIRED = 'EXPIRED'
    STATUS_CHOICES = [
        (STATUS_PENDING, _('Pending')),
        (STATUS_ACCEPTED, _('Accepted')),
        (STATUS_EXPIRED, _('Expired')),
    ]

    workspace = models.ForeignKey(
        'core.Workspace',
        on_delete=models.CASCADE,
        related_name='invitations',
        verbose_name=_('Workspace'),
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_invitations',
        verbose_name=_('Sender'),
    )
    email = models.EmailField(verbose_name=_('Email'))
    contact = models.OneToOneField(
        Contact,
        on_delete=models.CASCADE,
        related_name='invitation',
        verbose_name=_('Contact'),
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        verbose_name=_('Status'),
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created at'))
    expires_at = models.DateTimeField(verbose_name=_('Expires at'))

    class Meta:
        verbose_name = 'Приглашение'
        verbose_name_plural = 'Приглашения'
        db_table = 'hr_invitations'
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['email']),
        ]

    def __str__(self):
        return f"Invitation {self.email} -> {self.contact}"


class Department(models.Model):
    """Отдел (иерархия)."""
    workspace = models.ForeignKey(
        'core.Workspace',
        on_delete=models.CASCADE,
        related_name='hr_departments',
        verbose_name=_('Workspace'),
    )
    name = models.CharField(max_length=128, verbose_name=_('Name'))
    head = models.ForeignKey(
        'core.WorkspaceMember',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='headed_departments',
        verbose_name=_('Head'),
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
        verbose_name=_('Parent department'),
    )
    is_active = models.BooleanField(default=True, verbose_name=_('Is active'))

    class Meta:
        verbose_name = 'Подразделение'
        verbose_name_plural = 'Подразделения'
        db_table = 'hr_departments'
        ordering = ['name']
        indexes = [models.Index(fields=['workspace'])]

    def __str__(self):
        return self.name


class EmployeeProfile(models.Model):
    """Профиль сотрудника (связь с WorkspaceMember)."""
    STATUS_ACTIVE = 'ACTIVE'
    STATUS_ONBOARDING = 'ONBOARDING'
    STATUS_ON_LEAVE = 'ON_LEAVE'
    STATUS_TERMINATED = 'TERMINATED'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, _('Active')),
        (STATUS_ONBOARDING, _('Onboarding')),
        (STATUS_ON_LEAVE, _('On Leave')),
        (STATUS_TERMINATED, _('Terminated')),
    ]

    EMPLOYMENT_FULL_TIME = 'FULL_TIME'
    EMPLOYMENT_PART_TIME = 'PART_TIME'
    EMPLOYMENT_CONTRACTOR = 'CONTRACTOR'
    EMPLOYMENT_CHOICES = [
        (EMPLOYMENT_FULL_TIME, _('Full-time')),
        (EMPLOYMENT_PART_TIME, _('Part-time')),
        (EMPLOYMENT_CONTRACTOR, _('Contractor')),
    ]

    SALARY_FIXED = 'FIXED'
    SALARY_HOURLY = 'HOURLY'
    SALARY_CHOICES = [
        (SALARY_FIXED, _('Fixed (monthly)')),
        (SALARY_HOURLY, _('Hourly')),
    ]

    member = models.OneToOneField(
        'core.WorkspaceMember',
        on_delete=models.CASCADE,
        related_name='employee_profile',
        verbose_name=_('Workspace member'),
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees',
        verbose_name=_('Department'),
    )
    job_title = models.CharField(max_length=128, blank=True, verbose_name=_('Job title'))
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
        verbose_name=_('Status'),
    )
    date_hired = models.DateField(null=True, blank=True, verbose_name=_('Date hired'))
    date_terminated = models.DateField(null=True, blank=True, verbose_name=_('Date terminated'))
    employment_type = models.CharField(
        max_length=20,
        choices=EMPLOYMENT_CHOICES,
        default=EMPLOYMENT_FULL_TIME,
        verbose_name=_('Employment type'),
    )
    fte = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=1.0,
        verbose_name=_('FTE'),
        help_text=_('Full Time Equivalent'),
    )
    salary_mode = models.CharField(
        max_length=20,
        choices=SALARY_CHOICES,
        default=SALARY_FIXED,
        verbose_name=_('Salary mode'),
    )
    salary_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Salary amount'),
    )
    currency = models.CharField(max_length=3, default='RUB', verbose_name=_('Currency'))
    payment_wallet = models.ForeignKey(
        'finance.Wallet',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hr_employee_profiles',
        verbose_name=_('Payment wallet'),
    )
    settings = models.JSONField(default=dict, blank=True, verbose_name=_('Settings'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created at'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Updated at'))

    class Meta:
        verbose_name = 'Профиль сотрудника'
        verbose_name_plural = 'Профили сотрудников'
        db_table = 'hr_employee_profiles'
        indexes = [models.Index(fields=['member']), models.Index(fields=['status'])]

    def __str__(self):
        user = self.member.user if self.member_id else None
        name = f"{user.get_full_name() or user.username}" if user else f"Employee #{self.pk}"
        return f"{name} ({self.job_title or '-'})"


class LeaveRequest(models.Model):
    """Заявка на отпуск/отгул."""
    TYPE_VACATION = 'VACATION'
    TYPE_SICK_LEAVE = 'SICK_LEAVE'
    TYPE_UNPAID = 'UNPAID'
    TYPE_CHOICES = [
        (TYPE_VACATION, _('Vacation')),
        (TYPE_SICK_LEAVE, _('Sick leave')),
        (TYPE_UNPAID, _('Unpaid')),
    ]

    STATUS_PENDING = 'PENDING'
    STATUS_APPROVED = 'APPROVED'
    STATUS_REJECTED = 'REJECTED'
    STATUS_CANCELLED = 'CANCELLED'
    STATUS_CHOICES = [
        (STATUS_PENDING, _('Pending')),
        (STATUS_APPROVED, _('Approved')),
        (STATUS_REJECTED, _('Rejected')),
        (STATUS_CANCELLED, _('Cancelled')),
    ]

    member = models.ForeignKey(
        'core.WorkspaceMember',
        on_delete=models.CASCADE,
        related_name='leave_requests',
        verbose_name=_('Member'),
    )
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, verbose_name=_('Type'))
    start_date = models.DateField(verbose_name=_('Start date'))
    end_date = models.DateField(verbose_name=_('End date'))
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        verbose_name=_('Status'),
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_leave_requests',
        verbose_name=_('Approved by'),
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created at'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('Updated at'))

    class Meta:
        verbose_name = 'Заявка на отпуск'
        verbose_name_plural = 'Заявки на отпуск'
        db_table = 'hr_leave_requests'
        indexes = [models.Index(fields=['member']), models.Index(fields=['status'])]

    def clean(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValidationError(_('End date must be >= start date.'))
        qs = LeaveRequest.objects.filter(
            member=self.member,
        ).exclude(
            status__in=[LeaveRequest.STATUS_CANCELLED, LeaveRequest.STATUS_REJECTED],
        ).exclude(
            end_date__lt=self.start_date,
        ).exclude(
            start_date__gt=self.end_date,
        )
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        if qs.exists():
            raise ValidationError(_('Overlapping leave request exists for this member.'))

    def __str__(self):
        return f"{self.member} {self.get_type_display()} {self.start_date}–{self.end_date}"


class PayrollRun(models.Model):
    """Ведомость на выплату (заголовок)."""
    STATUS_DRAFT = 'DRAFT'
    STATUS_PAID = 'PAID'
    STATUS_CHOICES = [
        (STATUS_DRAFT, _('Draft')),
        (STATUS_PAID, _('Paid')),
    ]

    workspace = models.ForeignKey(
        'core.Workspace',
        on_delete=models.CASCADE,
        related_name='payroll_runs',
        verbose_name=_('Workspace'),
    )
    period_start = models.DateField(verbose_name=_('Period start'))
    period_end = models.DateField(verbose_name=_('Period end'))
    total_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_('Total amount'),
    )
    currency = models.CharField(max_length=3, default='RUB', verbose_name=_('Currency'))
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        verbose_name=_('Status'),
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_payroll_runs',
        verbose_name=_('Created by'),
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('Created at'))
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name=_('Paid at'))

    class Meta:
        verbose_name = 'Расчёт зарплаты'
        verbose_name_plural = 'Расчёты зарплаты'
        db_table = 'hr_payroll_runs'
        indexes = [models.Index(fields=['workspace']), models.Index(fields=['status'])]

    def __str__(self):
        return f"Payroll {self.period_start}–{self.period_end} ({self.status})"


class PayrollItem(models.Model):
    """Строка ведомости (расчёт по сотруднику)."""
    payroll_run = models.ForeignKey(
        PayrollRun,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name=_('Payroll run'),
    )
    employee = models.ForeignKey(
        EmployeeProfile,
        on_delete=models.CASCADE,
        related_name='payroll_items',
        verbose_name=_('Employee'),
    )
    gross_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_('Gross amount'),
    )
    net_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name=_('Net amount'),
    )
    days_worked = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Days worked'),
    )
    hours_worked = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Hours worked'),
    )
    calculation_details = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Calculation details'),
    )
    transaction = models.OneToOneField(
        'finance.Transaction',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payroll_item',
        verbose_name=_('Transaction'),
    )
    is_paid = models.BooleanField(default=False, verbose_name=_('Is paid'))

    class Meta:
        verbose_name = 'Строка расчёта зарплаты'
        verbose_name_plural = 'Строки расчёта зарплаты'
        db_table = 'hr_payroll_items'
        unique_together = [['payroll_run', 'employee']]
        indexes = [models.Index(fields=['payroll_run'])]

    def __str__(self):
        return f"{self.employee} {self.net_amount} {self.payroll_run}"


class EmployeeDocument(models.Model):
    """Документ сотрудника (договор, оферта, NDA, паспорт)."""
    DOC_OFFER = 'OFFER'
    DOC_CONTRACT = 'CONTRACT'
    DOC_NDA = 'NDA'
    DOC_PASSPORT = 'PASSPORT'
    DOC_OTHER = 'OTHER'
    DOC_TYPE_CHOICES = [
        (DOC_OFFER, _('Offer')),
        (DOC_CONTRACT, _('Contract')),
        (DOC_NDA, _('NDA')),
        (DOC_PASSPORT, _('Passport')),
        (DOC_OTHER, _('Other')),
    ]

    employee = models.ForeignKey(
        EmployeeProfile,
        on_delete=models.CASCADE,
        related_name='documents',
        verbose_name=_('Employee'),
    )
    doc_type = models.CharField(
        max_length=20,
        choices=DOC_TYPE_CHOICES,
        default=DOC_OTHER,
        verbose_name=_('Document type'),
    )
    file = models.FileField(
        upload_to='hr/employee_docs/%Y/%m/',
        verbose_name=_('File'),
    )
    name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name=_('Display name'),
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at'),
    )

    class Meta:
        verbose_name = 'Документ сотрудника'
        verbose_name_plural = 'Документы сотрудников'
        db_table = 'hr_employee_documents'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['employee'])]

    def __str__(self):
        return f"{self.employee} — {self.get_doc_type_display()} ({self.name or self.file.name})"
