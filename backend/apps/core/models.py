"""
Core models for Office Suite 360.
"""
from django.conf import settings as django_settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    """Расширенная модель пользователя."""

    ROLE_ADMIN = 'admin'
    ROLE_MEMBER = 'member'
    ROLE_GUEST = 'guest'

    ROLE_CHOICES = [
        (ROLE_ADMIN, _('Admin')),
        (ROLE_MEMBER, _('Member')),
        (ROLE_GUEST, _('Guest')),
    ]

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default=ROLE_MEMBER,
        blank=True,
        verbose_name=_('Role'),
        help_text=_('Глобальная роль пользователя в системе')
    )
    avatar = models.ImageField(
        upload_to='avatars/',
        null=True,
        blank=True,
        verbose_name=_('Avatar')
    )
    timezone = models.CharField(
        max_length=50,
        default='Europe/Moscow',
        verbose_name=_('Timezone')
    )
    settings = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Settings')
    )
    telegram_id = models.BigIntegerField(
        null=True,
        blank=True,
        unique=True,
        verbose_name=_('Telegram ID')
    )
    telegram_username = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name=_('Telegram Username')
    )
    company = models.ForeignKey(
        'crm.Company',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees',
        verbose_name=_('Company'),
        help_text=_('Организация, в которой работает пользователь')
    )
    is_onboarded = models.BooleanField(
        default=False,
        verbose_name=_('Onboarding completed'),
        help_text=_('Прошёл ли пользователь онбординг (workspace + первый ИИ)')
    )
    force_business_plan = models.BooleanField(
        default=False,
        verbose_name=_('Force business plan'),
        help_text=_('Принудительно считать тариф бизнесом (без рекламы, все функции)')
    )
    hide_ads = models.BooleanField(
        default=False,
        verbose_name=_('Hide ads'),
        help_text=_('Отключить показ рекламы для пользователя (ручная настройка в SaaS)')
    )

    class Meta:
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'
        db_table = 'users'
    
    def __str__(self):
        return self.username or self.email


# Алиас для совместимости со спецификациями
CustomUser = User


class UserEvent(models.Model):
    """События пользователя для аналитики: вход, отключение/включение рекламы, бизнес-тарифа, платежи."""
    EVENT_LOGIN = 'login'
    EVENT_ADS_OFF = 'ads_off'
    EVENT_ADS_ON = 'ads_on'
    EVENT_BUSINESS_OFF = 'business_off'
    EVENT_BUSINESS_ON = 'business_on'
    EVENT_PAYMENT = 'payment'

    EVENT_CHOICES = [
        (EVENT_LOGIN, _('Login')),
        (EVENT_ADS_OFF, _('Ads disabled')),
        (EVENT_ADS_ON, _('Ads enabled')),
        (EVENT_BUSINESS_OFF, _('Business plan disabled')),
        (EVENT_BUSINESS_ON, _('Business plan enabled')),
        (EVENT_PAYMENT, _('Payment')),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='events',
        verbose_name=_('User'),
    )
    event_type = models.CharField(
        max_length=32,
        choices=EVENT_CHOICES,
        verbose_name=_('Event type'),
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at'),
    )
    details = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Details'),
        help_text=_('Доп. данные: подписка, способ оплаты и т.д.'),
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('Amount'),
        help_text=_('Сумма платежа (для event_type=payment)'),
    )

    class Meta:
        verbose_name = _('User event')
        verbose_name_plural = _('User events')
        ordering = ['-created_at']
        db_table = 'user_events'

    def __str__(self):
        return f"{self.get_event_type_display()} — {self.user} @ {self.created_at}"


class Workspace(models.Model):
    """Рабочее пространство (организация)."""

    HEALTH_ON_TRACK = 'on_track'
    HEALTH_BEHIND = 'behind'
    HEALTH_CHOICES = [
        (HEALTH_ON_TRACK, _('On Track')),
        (HEALTH_BEHIND, _('Behind')),
    ]

    name = models.CharField(
        max_length=255,
        verbose_name=_('Name')
    )
    slug = models.SlugField(
        max_length=100,
        unique=True,
        verbose_name=_('Slug')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description')
    )
    logo = models.ImageField(
        upload_to='workspaces/logos/',
        null=True,
        blank=True,
        verbose_name=_('Logo')
    )
    settings = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Settings')
    )
    progress = models.PositiveIntegerField(
        default=0,
        verbose_name=_('Progress (%)'),
        help_text=_('0-100, среднее по активным проектам, пересчитывается сервисом')
    )
    health_status = models.CharField(
        max_length=20,
        choices=HEALTH_CHOICES,
        default=HEALTH_ON_TRACK,
        verbose_name=_('Health Status'),
        help_text=_('on_track / behind — по доле проектов в отставании')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at')
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_('Updated at')
    )
    companies = models.ManyToManyField(
        'crm.Company',
        related_name='workspaces',
        blank=True,
        verbose_name=_('Companies'),
        help_text=_('Контрагенты, работающие в этом пространстве')
    )
    owner = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='owned_workspaces',
        verbose_name=_('Owner'),
        help_text=_('Владелец; для личного пространства обязателен')
    )
    is_personal = models.BooleanField(
        default=False,
        editable=False,
        verbose_name=_('Is personal workspace'),
        help_text=_('Личное пространство пользователя; не учитывается в лимитах платных пространств')
    )

    class Meta:
        verbose_name = 'Рабочее пространство'
        verbose_name_plural = 'Рабочие пространства'
        db_table = 'workspaces'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['owner'],
                condition=Q(is_personal=True),
                name='unique_personal_workspace',
            ),
        ]

    @property
    def is_business_workspace(self):
        """Возвращает True, если это бизнес-пространство (не личное)."""
        return not self.is_personal

    def __str__(self):
        return self.name


class WorkspaceMember(models.Model):
    """Участник рабочего пространства (M2M через модель)."""
    
    ROLE_OWNER = 'owner'
    ROLE_ADMIN = 'admin'
    ROLE_MEMBER = 'member'
    ROLE_VIEWER = 'viewer'
    
    ROLE_CHOICES = [
        (ROLE_OWNER, _('Owner')),
        (ROLE_ADMIN, _('Admin')),
        (ROLE_MEMBER, _('Member')),
        (ROLE_VIEWER, _('Viewer')),
    ]
    
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name='memberships',
        verbose_name=_('Workspace')
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='workspace_memberships',
        verbose_name=_('User')
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default=ROLE_MEMBER,
        verbose_name=_('Role')
    )
    joined_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Joined at')
    )
    
    class Meta:
        verbose_name = 'Участник рабочего пространства'
        verbose_name_plural = 'Участники рабочего пространства'
        db_table = 'workspace_members'
        unique_together = [['workspace', 'user']]
        indexes = [
            models.Index(fields=['workspace', 'user']),
            models.Index(fields=['role']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.workspace} ({self.role})"


class ProjectMember(models.Model):
    """
    Участник проекта. Может быть привязан к User (реальный пользователь)
    или без User — теневой сотрудник (только display_name + роль/ставка).
    Связь с hr.Contact — для переходного периода поддерживается двойная запись (user + contact).
    """
    project = models.ForeignKey(
        'todo.Project',
        on_delete=models.CASCADE,
        related_name='members',
        verbose_name=_('Project')
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='project_memberships',
        verbose_name=_('User'),
        help_text=_('Пусто — теневой сотрудник (только имя и ставка)')
    )
    contact = models.ForeignKey(
        'hr.Contact',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='project_members',
        verbose_name=_('Contact'),
        help_text=_('Ссылка на HR-контакт (опционально в переходный период)'),
    )
    display_name = models.CharField(
        max_length=255,
        verbose_name=_('Display Name'),
        help_text=_('Имя из user или введённое вручную для теневого')
    )
    role = models.CharField(
        max_length=100,
        default='Member',
        verbose_name=_('Role'),
        help_text=_('Напр.: Manager, Developer')
    )
    hourly_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name=_('Hourly Rate'),
        help_text=_('Ставка для финансов/биллинга')
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
        verbose_name = 'Участник проекта'
        verbose_name_plural = 'Участники проекта'
        db_table = 'project_members'
        ordering = ['display_name']
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'user'],
                condition=Q(user__isnull=False),
                name='unique_project_user_when_user_set'
            )
        ]
        indexes = [
            models.Index(fields=['project']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return self.display_name

    def save(self, *args, **kwargs):
        if self.user and not self.display_name:
            self.display_name = (
                f"{self.user.first_name or ''} {self.user.last_name or ''}".strip()
                or self.user.username
                or str(self.user)
            )
        elif not self.display_name:
            self.display_name = _('Unnamed')
        super().save(*args, **kwargs)


class VerificationCode(models.Model):
    """Код подтверждения для различных операций."""
    
    CODE_TYPE_REGISTRATION = 'registration'
    CODE_TYPE_PASSWORD_RESET = 'password_reset'
    CODE_TYPE_PASSWORD_CHANGE = 'password_change'
    CODE_TYPE_LOGIN = 'login'
    
    CODE_TYPE_CHOICES = [
        (CODE_TYPE_REGISTRATION, _('Registration')),
        (CODE_TYPE_PASSWORD_RESET, _('Password Reset')),
        (CODE_TYPE_PASSWORD_CHANGE, _('Password Change')),
        (CODE_TYPE_LOGIN, _('Login')),
    ]
    
    code = models.CharField(
        max_length=6,
        verbose_name=_('Verification Code')
    )
    code_type = models.CharField(
        max_length=20,
        choices=CODE_TYPE_CHOICES,
        default=CODE_TYPE_REGISTRATION,
        verbose_name=_('Code Type')
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='verification_codes',
        verbose_name=_('User')
    )
    telegram_contact = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name=_('Telegram Contact'),
        help_text=_('Telegram username или номер телефона')
    )
    email = models.EmailField(
        blank=True,
        null=True,
        verbose_name=_('Email')
    )
    username = models.CharField(
        max_length=150,
        null=True,
        blank=True,
        verbose_name=_('Username')
    )
    password_hash = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name=_('Password Hash')
    )
    is_verified = models.BooleanField(
        default=False,
        verbose_name=_('Is Verified')
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Created at')
    )
    expires_at = models.DateTimeField(
        verbose_name=_('Expires at')
    )
    
    class Meta:
        verbose_name = 'Код подтверждения'
        verbose_name_plural = 'Коды подтверждения'
        db_table = 'verification_codes'
        indexes = [
            models.Index(fields=['code', 'telegram_contact']),
            models.Index(fields=['expires_at']),
        ]
    
    def __str__(self):
        contact = self.telegram_contact or self.email or self.username or 'unknown'
        return f"{self.code} ({self.code_type}) for {contact}"
    
    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at
