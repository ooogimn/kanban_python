# Migration: fill NULL start_time/end_time on ScheduleEntry, then make non-nullable

from datetime import datetime, time, timedelta

from django.db import migrations, models
from django.utils import timezone


def fill_schedule_entry_datetime(apps, schema_editor):
    """Заполнить start_time и end_time из date/time/duration или значениями по умолчанию."""
    ScheduleEntry = apps.get_model('schedule', 'ScheduleEntry')
    from django.db.models import Q
    qs = ScheduleEntry.objects.filter(Q(start_time__isnull=True) | Q(end_time__isnull=True))
    for entry in qs:
        if entry.start_time is None:
            if entry.date and entry.time is not None:
                t = entry.time if isinstance(entry.time, time) else (entry.time or time(0, 0))
                start = timezone.make_aware(datetime.combine(entry.date, t))
            else:
                start = timezone.now()
            entry.start_time = start
        if entry.end_time is None:
            if entry.duration:
                entry.end_time = entry.start_time + entry.duration
            else:
                entry.end_time = entry.start_time + timedelta(hours=1)
        entry.save()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('schedule', '0003_resource_workspace_required'),
    ]

    operations = [
        migrations.RunPython(fill_schedule_entry_datetime, noop),
        migrations.AlterField(
            model_name='scheduleentry',
            name='start_time',
            field=models.DateTimeField(verbose_name='Start Time'),
        ),
        migrations.AlterField(
            model_name='scheduleentry',
            name='end_time',
            field=models.DateTimeField(verbose_name='End Time'),
        ),
    ]
