# SPRINT 1 — Workspace progress & health_status

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_projectmember'),
    ]

    operations = [
        migrations.AddField(
            model_name='workspace',
            name='progress',
            field=models.PositiveIntegerField(
                default=0,
                help_text='0-100, среднее по активным проектам, пересчитывается сервисом',
                verbose_name='Progress (%)',
            ),
        ),
        migrations.AddField(
            model_name='workspace',
            name='health_status',
            field=models.CharField(
                choices=[('on_track', 'On Track'), ('behind', 'Behind')],
                default='on_track',
                help_text='on_track / behind — по доле проектов в отставании',
                max_length=20,
                verbose_name='Health Status',
            ),
        ),
    ]
