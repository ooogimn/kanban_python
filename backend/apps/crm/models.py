"""
CRM models for Office Suite 360.
"""
from django.db import models
from django.contrib.contenttypes.fields import GenericRelation
from django.utils.translation import gettext_lazy as _


class Company(models.Model):
    """Организация-контрагент."""

    TYPE_CLIENT = 'client'
    TYPE_CONTRACTOR = 'contractor'
    TYPE_PARTNER = 'partner'
    TYPE_SUPPLIER = 'supplier'

    TYPE_CHOICES = [
        (TYPE_CLIENT, _('Client')),
        (TYPE_CONTRACTOR, _('Contractor')),
        (TYPE_PARTNER, _('Partner')),
        (TYPE_SUPPLIER, _('Supplier')),
    ]

    # === ОСНОВНОЕ ===
    name = models.CharField(
        max_length=255,
        verbose_name=_('Company Name'),
        help_text=_('Полное наименование организации')
    )
    short_name = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('Short Name'),
        help_text=_('Краткое наименование')
    )
    type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default=TYPE_CLIENT,
        verbose_name=_('Type')
    )

    # === ЛОГОТИП ===
    logo = models.ImageField(
        upload_to='crm/companies/logos/',
        null=True,
        blank=True,
        verbose_name=_('Logo')
    )

    # === РЕКВИЗИТЫ ===
    inn = models.CharField(
        max_length=12,
        blank=True,
        verbose_name=_('INN'),
        help_text=_('ИНН организации (10 или 12 цифр)')
    )
    kpp = models.CharField(
        max_length=9,
        blank=True,
        verbose_name=_('KPP'),
        help_text=_('КПП организации')
    )
    ogrn = models.CharField(
        max_length=15,
        blank=True,
        verbose_name=_('OGRN'),
        help_text=_('ОГРН / ОГРНИП')
    )
    legal_address = models.TextField(
        blank=True,
        verbose_name=_('Legal Address'),
        help_text=_('Юридический адрес')
    )
    actual_address = models.TextField(
        blank=True,
        verbose_name=_('Actual Address'),
        help_text=_('Фактический адрес')
    )

    # === БАНКОВСКИЕ РЕКВИЗИТЫ ===
    bank_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name=_('Bank Name')
    )
    bank_bik = models.CharField(
        max_length=9,
        blank=True,
        verbose_name=_('BIK')
    )
    bank_account = models.CharField(
        max_length=20,
        blank=True,
        verbose_name=_('Account Number'),
        help_text=_('Расчётный счёт')
    )
    bank_corr_account = models.CharField(
        max_length=20,
        blank=True,
        verbose_name=_('Correspondent Account'),
        help_text=_('Корреспондентский счёт')
    )

    # === КОНТАКТЫ ===
    email = models.EmailField(
        blank=True,
        verbose_name=_('Email')
    )
    phone = models.CharField(
        max_length=20,
        blank=True,
        verbose_name=_('Phone')
    )
    website = models.URLField(
        blank=True,
        verbose_name=_('Website')
    )

    # === ДОПОЛНИТЕЛЬНО ===
    description = models.TextField(
        blank=True,
        verbose_name=_('Description'),
        help_text=_('Примечания, особенности работы')
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name=_('Is Active')
    )

    # === ФАЙЛЫ (договоры, акты) ===
    files = GenericRelation(
        'documents.Attachment',
        content_type_field='content_type',
        object_id_field='object_id',
        related_query_name='company'
    )

    # === ВРЕМЕННЫЕ МЕТКИ ===
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Компания'
        verbose_name_plural = 'Компании'
        db_table = 'companies'
        ordering = ['name']
        indexes = [
            models.Index(fields=['inn']),
            models.Index(fields=['type', 'is_active']),
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return self.short_name or self.name


class Customer(models.Model):
    """
    Клиент (CRM-Lite для монетизации и AI Context).
    
    Изолирован по workspace — критично для multi-tenancy.
    """
    
    STATUS_LEAD = 'lead'
    STATUS_ACTIVE = 'active'
    STATUS_ARCHIVED = 'archived'
    
    STATUS_CHOICES = [
        (STATUS_LEAD, _('Lead')),
        (STATUS_ACTIVE, _('Active')),
        (STATUS_ARCHIVED, _('Archived')),
    ]
    
    name = models.CharField(
        max_length=255,
        verbose_name=_('Name'),
        help_text=_('Имя клиента или название компании')
    )
    contact_email = models.EmailField(
        blank=True,
        verbose_name=_('Contact Email')
    )
    telegram_username = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('Telegram Username'),
        help_text=_('Для будущих ботов и уведомлений')
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_LEAD,
        verbose_name=_('Status')
    )
    notes = models.TextField(
        blank=True,
        verbose_name=_('Notes'),
        help_text=_('Дополнительная информация о клиенте')
    )
    workspace = models.ForeignKey(
        'core.Workspace',
        on_delete=models.CASCADE,
        related_name='customers',
        verbose_name=_('Workspace'),
        help_text=_('Изоляция данных по workspace')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at')
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_('Updated at')
    )
    
    class Meta:
        verbose_name = 'Клиент'
        verbose_name_plural = 'Клиенты'
        db_table = 'customers'
        ordering = ['name']
        indexes = [
            models.Index(fields=['workspace', 'status']),
            models.Index(fields=['name']),
        ]
    
    def __str__(self):
        return self.name
