# Generated for Task 0.3 — умные уведомления о бюджете

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('todo', '0006_workitem_sort_order'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='last_budget_alert_level',
            field=models.IntegerField(
                choices=[
                    (0, 'None'),
                    (80, 'Warning (80%)'),
                    (100, 'Critical (100%)'),
                ],
                default=0,
                help_text='Уровень последнего отправленного уведомления о бюджете',
                verbose_name='Last Budget Alert Level',
            ),
        ),
    ]
