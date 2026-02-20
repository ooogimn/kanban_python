"""
Signals for kanban app.
Модель Card удалена. Канбан — представление WorkItem.
При создании Stage автоматически создаются 3 колонки: PLAN, IN_PROGRESS, DONE.
WebSocket/экспорт при перемещении вызываются из move_task view.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.translation import gettext_lazy as _

from .models import Stage, Column


@receiver(post_save, sender=Stage)
def stage_post_save_create_columns(sender, instance, created, **kwargs):
    """
    При создании Stage создаём 3 обязательные колонки с system_type:
    PLAN, IN_PROGRESS, DONE.
    """
    if not created:
        return
    if hasattr(instance, '_skip_signal') and instance._skip_signal:
        return
    if instance.columns.exists():
        return
    # Позиции с шагом: между ними можно вставлять пользовательские колонки
    # PLAN=1000, IN_PROGRESS=5000, DONE=9000
    Column.objects.bulk_create([
        Column(
            name=_('В плане'),
            column_type=Column.COLUMN_TYPE_TODO,
            system_type=Column.SYSTEM_TYPE_PLAN,
            stage=instance,
            position=1000,
            color='#3b82f6',
        ),
        Column(
            name=_('В работе'),
            column_type=Column.COLUMN_TYPE_IN_PROGRESS,
            system_type=Column.SYSTEM_TYPE_IN_PROGRESS,
            stage=instance,
            position=5000,
            color='#f59e0b',
        ),
        Column(
            name=_('Завершено'),
            column_type=Column.COLUMN_TYPE_COMPLETED,
            system_type=Column.SYSTEM_TYPE_DONE,
            stage=instance,
            position=9000,
            color='#10b981',
        ),
    ])
