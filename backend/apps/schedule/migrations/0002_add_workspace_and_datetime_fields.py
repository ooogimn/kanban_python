# Generated for Task 1.1 — Schedule API Production Grade

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('schedule', '0001_initial'),
        ('core', '0004_verificationcode'),
    ]

    operations = [
        # Добавляем workspace к Resource
        migrations.AddField(
            model_name='resource',
            name='workspace',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='resources',
                to='core.workspace',
                verbose_name='Workspace',
                # Временно null=True для существующих записей
                null=True,
            ),
        ),
        # Добавляем start_time и end_time к ScheduleEntry
        migrations.AddField(
            model_name='scheduleentry',
            name='start_time',
            field=models.DateTimeField(
                verbose_name='Start Time',
                null=True,  # Временно для миграции
            ),
        ),
        migrations.AddField(
            model_name='scheduleentry',
            name='end_time',
            field=models.DateTimeField(
                verbose_name='End Time',
                null=True,  # Временно для миграции
            ),
        ),
        # Делаем старые поля nullable
        migrations.AlterField(
            model_name='scheduleentry',
            name='date',
            field=models.DateField(
                blank=True,
                null=True,
                verbose_name='Date'
            ),
        ),
        migrations.AlterField(
            model_name='scheduleentry',
            name='time',
            field=models.TimeField(
                blank=True,
                null=True,
                verbose_name='Time'
            ),
        ),
        migrations.AlterField(
            model_name='scheduleentry',
            name='duration',
            field=models.DurationField(
                blank=True,
                null=True,
                verbose_name='Duration'
            ),
        ),
        # Обновляем индексы и ordering
        migrations.AlterModelOptions(
            name='scheduleentry',
            options={
                'ordering': ['start_time'],
                'verbose_name': 'Schedule Entry',
                'verbose_name_plural': 'Schedule Entries',
            },
        ),
        # Добавляем индексы
        migrations.AddIndex(
            model_name='resource',
            index=models.Index(fields=['workspace'], name='resources_workspace_idx'),
        ),
        migrations.AddIndex(
            model_name='scheduleentry',
            index=models.Index(fields=['start_time', 'end_time'], name='schedule_entries_time_idx'),
        ),
        migrations.AddIndex(
            model_name='scheduleentry',
            index=models.Index(fields=['resource'], name='schedule_entries_resource_idx'),
        ),
    ]
