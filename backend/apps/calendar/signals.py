"""
Signals for calendar app — обратная синхронизация CalendarEvent → WorkItem.

При перетаскивании/изменении дат события в календаре обновляются сроки
связанной задачи (WorkItem). Прямая синхронизация WorkItem → CalendarEvent
реализована в apps.todo.signals.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='calendar.CalendarEvent')
def calendar_event_post_save(sender, instance, created, **kwargs):
    """
    При сохранении CalendarEvent с related_workitem обновляем даты задачи.

    CalendarEvent использует DateTimeField (start_date, end_date),
    WorkItem — DateField (start_date, due_date). Выполняем преобразование
    типов (обрезаем время). Сохранение WorkItem с _skip_signal предотвращает
    рекурсию (todo.signals не создаст повторное обновление CalendarEvent).
    """
    if getattr(instance, '_skip_signal', False):
        return
    if not instance.related_workitem_id:
        return

    workitem = instance.related_workitem

    start_date = None
    if instance.start_date:
        start_date = (
            instance.start_date.date()
            if hasattr(instance.start_date, 'date')
            else instance.start_date
        )
    due_date = None
    if instance.end_date:
        due_date = (
            instance.end_date.date()
            if hasattr(instance.end_date, 'date')
            else instance.end_date
        )

    if start_date is None and due_date is None:
        return

    update_fields = []
    if start_date is not None and workitem.start_date != start_date:
        workitem.start_date = start_date
        update_fields.append('start_date')
    if due_date is not None and workitem.due_date != due_date:
        workitem.due_date = due_date
        update_fields.append('due_date')

    if not update_fields:
        return

    workitem._skip_signal = True
    workitem.save(update_fields=update_fields)
