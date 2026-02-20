from django.apps import AppConfig


class GanttConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.gantt'
    verbose_name = 'Диаграмма Ганта'

    def ready(self):
        """Импорт сигналов при готовности приложения."""
        import apps.gantt.signals  # noqa
