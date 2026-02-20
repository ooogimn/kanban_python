# STEP 2 — Project: progress, health_status

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('todo', '0012_workitem_stage_responsible'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='progress',
            field=models.IntegerField(
                default=0,
                help_text='0-100, среднее по этапам (Stage), пересчитывается сервисом',
                verbose_name='Progress (%)',
            ),
        ),
        migrations.AddField(
            model_name='project',
            name='health_status',
            field=models.CharField(
                default='on_track',
                help_text='on_track / behind — по этапам проекта',
                max_length=20,
                verbose_name='Health Status',
            ),
        ),
    ]
