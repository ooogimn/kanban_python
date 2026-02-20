from django.apps import AppConfig


class KanbanConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.kanban'
    verbose_name = 'Канбан'

    def ready(self):
        """Импорт сигналов при готовности приложения."""
        import apps.kanban.signals  # noqa
