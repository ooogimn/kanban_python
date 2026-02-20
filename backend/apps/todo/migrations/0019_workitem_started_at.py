# Generated migration: WorkItem.started_at для анализа «в графике»

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('todo', '0018_project_is_personal'),
    ]

    operations = [
        migrations.AddField(
            model_name='workitem',
            name='started_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Фактическое время первого перевода в «В работе» (для анализа «в графике»)',
                null=True,
                verbose_name='Started At',
            ),
        ),
    ]
