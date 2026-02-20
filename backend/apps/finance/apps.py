from django.apps import AppConfig


class FinanceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.finance'
    verbose_name = 'Финансы'

    def ready(self):
        """Импорт сигналов при готовности приложения."""
        import apps.finance.signals  # noqa: F401
