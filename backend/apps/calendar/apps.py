from django.apps import AppConfig


class CalendarConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.calendar'
    verbose_name = 'Календарь'

    def ready(self):
        import apps.calendar.signals  # noqa: F401 — регистрация сигналов CalendarEvent → WorkItem
