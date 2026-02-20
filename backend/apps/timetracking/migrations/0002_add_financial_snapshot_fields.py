# Generated for Task 2.3 — Авто-Биллинг и Financial Snapshotting

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('timetracking', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='timelog',
            name='billable',
            field=models.BooleanField(
                default=True,
                help_text='Подлежит ли биллингу',
                verbose_name='Billable'
            ),
        ),
        migrations.AddField(
            model_name='timelog',
            name='hourly_rate',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Ставка на момент работы (snapshot)',
                max_digits=10,
                null=True,
                verbose_name='Hourly Rate'
            ),
        ),
        migrations.AddField(
            model_name='timelog',
            name='amount',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Итоговая стоимость лога (snapshot)',
                max_digits=10,
                null=True,
                verbose_name='Amount'
            ),
        ),
    ]
