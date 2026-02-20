from django.apps import AppConfig


class TodoConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.todo'
    verbose_name = 'Задачи и проекты'

    def ready(self):
        """Импорт сигналов при готовности приложения."""
        import apps.todo.signals  # noqa
