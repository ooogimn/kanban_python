"""
HR app configuration.
"""
from django.apps import AppConfig


class HrConfig(AppConfig):
    """HR (Human Resources) app config."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.hr'
    verbose_name = 'Управление персоналом'
