from django.apps import AppConfig


class TimetrackingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.timetracking'
    verbose_name = 'Учёт времени'

    def ready(self):
        import apps.timetracking.signals  # noqa: F401 — post_save TimeLog → check_project_budget
