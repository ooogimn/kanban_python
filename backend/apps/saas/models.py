"""
SaaS models — Plan (тарифы).
"""
from decimal import Decimal

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
