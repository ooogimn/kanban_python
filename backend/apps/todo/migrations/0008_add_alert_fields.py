# Generated for Task 1.2 — Heartbeat (дедлайны и лимиты времени)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('todo', '0007_add_last_budget_alert_level'),
    ]

    operations = [
        migrations.AddField(
            model_name='workitem',
            name='deadline_notification_sent',
            field=models.CharField(
                choices=[
                    ('none', 'None'),
                    ('48h', '48 hours'),
                    ('24h', '24 hours'),
                    ('overdue', 'Overdue'),
                ],
                default='none',
                help_text='Статус последнего отправленного уведомления о дедлайне',
                max_length=20,
                verbose_name='Deadline Notification Status',
            ),
        ),
        migrations.AddField(
            model_name='workitem',
            name='time_alert_sent',
            field=models.BooleanField(
                default=False,
                help_text='Флаг: уведомление о перерасходе времени отправлено',
                verbose_name='Time Overrun Alert Sent',
            ),
        ),
    ]
