"""
Signals for timetracking app — пересчёт бюджета при изменении TimeLog.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='timetracking.TimeLog')
def timelog_post_save(sender, instance, created, **kwargs):
    """
    После сохранения TimeLog пересчитываем пороги бюджета проекта
    (стоимость по учёту времени, уведомления при 80% и 100%).
    """
    try:
        project = instance.workitem.project
    except Exception:
        return
    try:
        from apps.core.services import check_project_budget
        check_project_budget(project)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(
            'check_project_budget after TimeLog save: %s', e
        )
