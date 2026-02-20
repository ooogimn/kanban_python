"""
SaaS app configuration — Plans & Super Admin.
"""
from django.apps import AppConfig


class SaasConfig(AppConfig):
    """SaaS app config."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.saas'
    verbose_name = 'SaaS (тарифы и супер-админ)'
