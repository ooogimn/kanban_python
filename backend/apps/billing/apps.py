"""
Billing app configuration.
"""
from django.apps import AppConfig


class BillingConfig(AppConfig):
    """Billing app config."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.billing'
    verbose_name = 'Биллинг (счета и подписки)'
