# HR-SPRINT 4: Payroll — is_paid, paid_at on TimeLog

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('timetracking', '0002_add_financial_snapshot_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='timelog',
            name='is_paid',
            field=models.BooleanField(db_index=True, default=False, help_text='Оплачен ли лог (Payroll)', verbose_name='Is paid'),
        ),
        migrations.AddField(
            model_name='timelog',
            name='paid_at',
            field=models.DateTimeField(blank=True, help_text='Дата/время оплаты по ведомости', null=True, verbose_name='Paid at'),
        ),
    ]
