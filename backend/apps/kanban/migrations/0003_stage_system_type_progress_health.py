# REFACTORING: Board -> Stage, add progress/health_status, Column.system_type

from django.db import migrations, models


def set_column_system_type(apps, schema_editor):
    """Проставить system_type существующим колонкам по column_type."""
    Column = apps.get_model('kanban', 'Column')
    for col in Column.objects.all():
        if col.column_type == 'todo':
            col.system_type = 'plan'
        elif col.column_type == 'in_progress' or col.column_type == 'review':
            col.system_type = 'in_progress'
        elif col.column_type == 'completed':
            col.system_type = 'done'
        else:
            col.system_type = 'other'
        col.save(update_fields=['system_type'])


class Migration(migrations.Migration):

    dependencies = [
        ('kanban', '0002_remove_card_model'),
    ]

    operations = [
        # 1) Добавить progress и health_status в Board (таблица boards)
        migrations.AddField(
            model_name='board',
            name='progress',
            field=models.IntegerField(default=0, help_text='0-100, пересчитывается по задачам этапа', verbose_name='Progress (%)'),
        ),
        migrations.AddField(
            model_name='board',
            name='health_status',
            field=models.CharField(
                choices=[('on_track', 'On Track'), ('behind', 'Behind')],
                default='on_track',
                max_length=20,
                verbose_name='Health Status',
            ),
        ),
        # 2) Добавить system_type в Column
        migrations.AddField(
            model_name='column',
            name='system_type',
            field=models.CharField(
                choices=[('plan', 'In plan'), ('in_progress', 'In progress'), ('done', 'Done'), ('other', 'Other')],
                default='other',
                help_text='plan / in_progress / done — для расчёта прогресса этапа',
                max_length=20,
                verbose_name='System Type',
            ),
        ),
        migrations.RunPython(set_column_system_type, migrations.RunPython.noop),
        # 3) Переименовать модель Board -> Stage (таблица остаётся boards через db_table в Meta)
        migrations.RenameModel(
            old_name='Board',
            new_name='Stage',
        ),
        # 4) Переименовать Column.board -> Column.stage (колонка board_id -> stage_id)
        migrations.RenameField(
            model_name='column',
            old_name='board',
            new_name='stage',
        ),
        # 5) Сохранить имя таблицы 'boards' для Stage (совместимость)
        migrations.AlterModelTable(
            name='stage',
            table='boards',
        ),
    ]
