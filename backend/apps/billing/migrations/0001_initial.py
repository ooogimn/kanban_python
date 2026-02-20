# Generated for Task 4.1 — Billing / PDF Invoicing

import decimal
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('timetracking', '0002_add_financial_snapshot_fields'),
        ('todo', '0010_add_hourly_rate_to_project'),
        ('crm', '0003_add_customer_model'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Invoice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('number', models.CharField(help_text='Формат INV-YYYY-XXXX', max_length=32, unique=True, verbose_name='Invoice Number')),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('sent', 'Sent'), ('paid', 'Paid'), ('cancelled', 'Cancelled')], default='draft', max_length=20, verbose_name='Status')),
                ('date_issue', models.DateField(default=timezone.now, verbose_name='Issue Date')),
                ('date_due', models.DateField(verbose_name='Due Date')),
                ('amount_total', models.DecimalField(decimal_places=2, default=decimal.Decimal('0'), max_digits=14, verbose_name='Total Amount')),
                ('pdf_file', models.FileField(blank=True, null=True, upload_to='invoices/%Y/%m/', verbose_name='PDF File')),
                ('line_items', models.JSONField(default=list, help_text='Снимок строк счёта [{title, hours, rate, amount}, ...]', verbose_name='Line Items Snapshot')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_invoices', to=settings.AUTH_USER_MODEL, verbose_name='Created by')),
                ('customer', models.ForeignKey(blank=True, help_text='Клиент (денормализация для истории)', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='invoices', to='crm.customer', verbose_name='Customer')),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='invoices', to='todo.project', verbose_name='Project')),
            ],
            options={
                'verbose_name': 'Invoice',
                'verbose_name_plural': 'Invoices',
                'db_table': 'invoices',
                'ordering': ['-date_issue', '-created_at'],
            },
        ),
        migrations.AddField(
            model_name='invoice',
            name='related_timelogs',
            field=models.ManyToManyField(blank=True, help_text='Таймлоги, включённые в счёт', related_name='invoices', to='timetracking.timelog', verbose_name='Related Time Logs'),
        ),
        migrations.AddIndex(
            model_name='invoice',
            index=models.Index(fields=['project'], name='invoices_project_idx'),
        ),
        migrations.AddIndex(
            model_name='invoice',
            index=models.Index(fields=['status'], name='invoices_status_idx'),
        ),
        migrations.AddIndex(
            model_name='invoice',
            index=models.Index(fields=['date_issue'], name='invoices_date_issue_idx'),
        ),
    ]
