# Generated for Task 2.3 — Авто-Биллинг и Financial Snapshotting

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('todo', '0009_add_customer_to_project'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='hourly_rate',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Стоимость часа работы по проекту (для авто-биллинга)',
                max_digits=10,
                null=True,
                verbose_name='Hourly Rate'
            ),
        ),
    ]
