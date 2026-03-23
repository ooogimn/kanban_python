"""
SaaS models — Plan (тарифы).
"""
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


def default_limits():
    return {
        'max_system_contacts': 10,
        'max_ai_agents': 1,
        'features': {
            'hr': True,
            'payroll': False,
            'ai_analyst': False,
        },
    }


class Plan(models.Model):
    """
    Тарифный план (Free, Pro, Enterprise).
    Лимиты и фичи хранятся в JSON.
    """
    name = models.CharField(
        max_length=64,
        verbose_name=_('Name'),
        help_text=_('Free, Pro, Enterprise'),
    )
    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0'),
        verbose_name=_('Price'),
    )
    currency = models.CharField(
        max_length=6,
        default='RUB',
        verbose_name=_('Currency'),
    )
    limits = models.JSONField(
        default=default_limits,
        verbose_name=_('Limits'),
        help_text=_('max_system_contacts, max_ai_agents, features'),
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name=_('Active'),
    )
    is_default = models.BooleanField(
        default=False,
        verbose_name=_('Default plan'),
        help_text=_('План по умолчанию для новых подписок'),
    )
    is_recommended = models.BooleanField(
        default=False,
        verbose_name=_('Recommended plan'),
        help_text=_('Маркетинговая отметка для лендинга и карточек тарифов'),
    )
    recommended_badge = models.CharField(
        max_length=64,
        blank=True,
        default='',
        verbose_name=_('Recommended badge'),
        help_text=_('Короткая подпись бейджа, например: РЕКОМЕНДОВАН, ЗВЕЗДА, MEDAL'),
    )
    recommended_note = models.CharField(
        max_length=160,
        blank=True,
        default='',
        verbose_name=_('Recommended note'),
        help_text=_('Дополнительный текст под бейджем, например: для студентов'),
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
        verbose_name = _('Plan')
        verbose_name_plural = _('Plans')
        db_table = 'saas_plans'
        ordering = ['price']

    def __str__(self):
        return f"{self.name} — {self.price} {self.currency}"


class SaasPlatformSettings(models.Model):
    """
    Единые настройки интеграций/маркетинга/платежей для SaaS панели.
    Хранятся в одной записи singleton.
    """

    singleton_key = models.CharField(max_length=32, unique=True, default='default', editable=False)

    brand_name = models.CharField(max_length=128, default='AntExpress')
    public_site_url = models.URLField(max_length=512, default='https://antexpress.ru')

    yandex_webmaster_verification = models.CharField(max_length=255, blank=True, default='')
    yandex_metrika_counter_id = models.CharField(max_length=64, blank=True, default='')
    yandex_metrika_tag = models.TextField(blank=True, default='')
    google_analytics_measurement_id = models.CharField(max_length=64, blank=True, default='')
    google_tag_manager_id = models.CharField(max_length=64, blank=True, default='')

    yandex_rsy_site_id = models.CharField(max_length=128, blank=True, default='')
    yandex_rsy_block_id = models.CharField(max_length=128, blank=True, default='')
    yandex_rsy_script = models.TextField(blank=True, default='')
    custom_head_html = models.TextField(blank=True, default='')
    custom_body_html = models.TextField(blank=True, default='')
    landing_media_categories = models.JSONField(blank=True, default=list)
    landing_media_carousel = models.JSONField(blank=True, default=list)
    landing_portal_cards = models.JSONField(blank=True, default=list)
    landing_plan_styles = models.JSONField(blank=True, default=list)
    settings_history = models.JSONField(blank=True, default=list)
    default_landing_category = models.CharField(max_length=128, blank=True, default='')
    landing_default_version = models.CharField(max_length=16, blank=True, default='v2')
    landing_private_reviews = models.JSONField(blank=True, default=list)
    landing_company_reviews = models.JSONField(blank=True, default=list)
    landing_pending_reviews = models.JSONField(blank=True, default=list)
    landing_lead_requests = models.JSONField(blank=True, default=list)
    landing_ai_canned_responses = models.JSONField(blank=True, default=list)
    landing_ai_fallback_reply = models.TextField(blank=True, default='Напишите подробнее, и мы скоро подключим расширенный ИИ-ответ.')
    landing_ai_chat_logs = models.JSONField(blank=True, default=list)

    yookassa_shop_id = models.CharField(max_length=128, blank=True, default='')
    yookassa_secret_key = models.CharField(max_length=255, blank=True, default='')
    yookassa_return_url = models.URLField(max_length=512, blank=True, default='')

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_saas_platform_settings',
    )

    class Meta:
        verbose_name = _('SaaS platform settings')
        verbose_name_plural = _('SaaS platform settings')
        db_table = 'saas_platform_settings'

    def __str__(self):
        return f"SaaS settings ({self.singleton_key})"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(singleton_key='default')
        return obj
