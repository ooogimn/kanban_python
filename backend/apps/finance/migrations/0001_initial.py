# Generated for Finance - Transaction model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('todo', '0004_workitem_finance_project_budget'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Transaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(choices=[('income', 'Income'), ('expense', 'Expense'), ('hold', 'Hold')], max_length=20, verbose_name='Type')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('completed', 'Completed'), ('cancelled', 'Cancelled')], default='pending', max_length=20, verbose_name='Status')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12, verbose_name='Amount')),
                ('currency', models.CharField(default='RUB', max_length=3, verbose_name='Currency')),
                ('description', models.TextField(blank=True, verbose_name='Description')),
                ('receipt', models.FileField(blank=True, help_text='Файл чека/подтверждения', null=True, upload_to='finance/receipts/%Y/%m/', verbose_name='Receipt')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_transactions', to=settings.AUTH_USER_MODEL, verbose_name='Created By')),
                ('project', models.ForeignKey(help_text='Проект (общий бюджет)', on_delete=django.db.models.deletion.CASCADE, related_name='transactions', to='todo.project', verbose_name='Project')),
                ('workitem', models.ForeignKey(blank=True, help_text='Задача (конкретная трата)', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transactions', to='todo.workitem', verbose_name='Work Item')),
            ],
            options={
                'verbose_name': 'Transaction',
                'verbose_name_plural': 'Transactions',
                'db_table': 'transactions',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(fields=['project', 'type', 'status'], name='transaction_project_idx'),
        ),
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(fields=['workitem'], name='transaction_workitem_idx'),
        ),
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(fields=['created_at'], name='transaction_created_idx'),
        ),
    ]
