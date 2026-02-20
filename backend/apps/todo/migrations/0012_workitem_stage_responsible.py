# STEP 1.2 — WorkItem: stage, responsible; assigned_to deprecated

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_projectmember'),
        ('kanban', '0004_alter_stage_options_and_more'),
        ('todo', '0011_alter_workitem_kanban_column'),
    ]

    operations = [
        migrations.AddField(
            model_name='workitem',
            name='stage',
            field=models.ForeignKey(
                blank=True,
                help_text='Этап (канбан), на котором отображается задача',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='workitems',
                to='kanban.stage',
                verbose_name='Stage',
            ),
        ),
        migrations.AddField(
            model_name='workitem',
            name='responsible',
            field=models.ForeignKey(
                blank=True,
                help_text='Ответственный (реальный участник или теневой сотрудник)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='assigned_workitems',
                to='core.projectmember',
                verbose_name='Responsible',
            ),
        ),
        migrations.AddIndex(
            model_name='workitem',
            index=models.Index(fields=['stage'], name='work_items_stage_id_1a2b3c_idx'),
        ),
        migrations.AlterField(
            model_name='workitem',
            name='assigned_to',
            field=models.ManyToManyField(
                blank=True,
                help_text='Deprecated: предпочтительно использовать responsible (ProjectMember).',
                related_name='assigned_tasks',
                to='core.user',
                verbose_name='Assigned To',
            ),
        ),
    ]
