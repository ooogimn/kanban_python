# Generated for Task 3.1 — Асинхронный биллинг, идемпотентность по TimeLog

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0003_refactor_transaction_ledger'),
        ('timetracking', '0002_add_financial_snapshot_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='related_timelog',
            field=models.ForeignKey(
                blank=True,
                help_text='Лог времени (для идемпотентности биллинга)',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='finance_transactions',
                to='timetracking.timelog',
                verbose_name='Related Time Log'
            ),
        ),
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(fields=['related_timelog'], name='transactions_timelog_idx'),
        ),
    ]
