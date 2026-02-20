"""
Signals for gantt app - синхронизация GanttTask с WorkItem.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import GanttTask


@receiver(post_save, sender=GanttTask)
def gantt_task_post_save(sender, instance, created, **kwargs):
    """
    Сигнал при сохранении GanttTask.
    Обновляет связанный WorkItem.
    """
    # Предотвращаем рекурсию
    if hasattr(instance, '_skip_signal'):
        return
    
    # Если есть связанная задача, обновляем её
    if instance.related_workitem:
        workitem = instance.related_workitem
        
        # Обновляем даты
        if instance.start_date:
            workitem.start_date = instance.start_date
        if instance.end_date:
            workitem.due_date = instance.end_date
        if instance.progress is not None:
            workitem.progress = instance.progress
        
        # Предотвращаем рекурсию
        workitem._skip_signal = True
        workitem.save()
