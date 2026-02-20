# Generated for Task 2.2 — Ledger & Holds с защитой от Race Conditions

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0002_rename_transaction_project_idx_transaction_project_299495_idx_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('todo', '0009_add_customer_to_project'),
    ]

    operations = [
        # Удаляем старые поля
        migrations.RemoveField(
            model_name='transaction',
            name='status',
        ),
        migrations.RemoveField(
            model_name='transaction',
            name='currency',
        ),
        migrations.RemoveField(
            model_name='transaction',
            name='receipt',
        ),
        migrations.RemoveField(
            model_name='transaction',
            name='completed_at',
        ),
        migrations.RemoveField(
            model_name='transaction',
            name='updated_at',
        ),
        migrations.RemoveField(
            model_name='transaction',
            name='workitem',
        ),
        # Обновляем type choices
        migrations.AlterField(
            model_name='transaction',
            name='type',
            field=models.CharField(
                choices=[
                    ('deposit', 'Deposit'),
                    ('spend', 'Spend'),
                    ('hold', 'Hold'),
                    ('release', 'Release')
                ],
                max_length=20,
                verbose_name='Type'
            ),
        ),
        # Обновляем amount
        migrations.AlterField(
            model_name='transaction',
            name='amount',
            field=models.DecimalField(
                decimal_places=2,
                help_text='Всегда положительное число',
                max_digits=14,
                verbose_name='Amount'
            ),
        ),
        # Обновляем project (CASCADE -> PROTECT)
        migrations.AlterField(
            model_name='transaction',
            name='project',
            field=models.ForeignKey(
                help_text='Проект (общий бюджет)',
                on_delete=django.db.models.deletion.PROTECT,
                related_name='transactions',
                to='todo.project',
                verbose_name='Project'
            ),
        ),
        # Обновляем created_by (SET_NULL -> PROTECT)
        migrations.AlterField(
            model_name='transaction',
            name='created_by',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='created_transactions',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Created By'
            ),
        ),
        # Добавляем related_workitem
        migrations.AddField(
            model_name='transaction',
            name='related_workitem',
            field=models.ForeignKey(
                blank=True,
                help_text='Задача (для HOLD/SPEND)',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='finance_transactions',
                to='todo.workitem',
                verbose_name='Related Work Item'
            ),
        ),
        # Обновляем индексы
        migrations.AlterModelOptions(
            name='transaction',
            options={
                'ordering': ['-created_at'],
                'verbose_name': 'Transaction',
                'verbose_name_plural': 'Transactions',
            },
        ),
        migrations.AlterIndexTogether(
            name='transaction',
            index_together=set(),
        ),
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(fields=['project', 'type'], name='transactions_project_type_idx'),
        ),
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(fields=['related_workitem'], name='transactions_workitem_idx'),
        ),
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(fields=['created_at'], name='transactions_created_idx'),
        ),
    ]
