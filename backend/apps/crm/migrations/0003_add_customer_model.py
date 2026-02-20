# Generated for Task 2.1 — CRM-Lite и AI Context Service

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crm', '0002_rename_companies_inn_idx_companies_inn_1e26b0_idx_and_more'),
        ('core', '0004_verificationcode'),
    ]

    operations = [
        migrations.CreateModel(
            name='Customer',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='Имя клиента или название компании', max_length=255, verbose_name='Name')),
                ('contact_email', models.EmailField(blank=True, max_length=254, verbose_name='Contact Email')),
                ('telegram_username', models.CharField(blank=True, help_text='Для будущих ботов и уведомлений', max_length=100, verbose_name='Telegram Username')),
                ('status', models.CharField(choices=[('lead', 'Lead'), ('active', 'Active'), ('archived', 'Archived')], default='lead', max_length=20, verbose_name='Status')),
                ('notes', models.TextField(blank=True, help_text='Дополнительная информация о клиенте', verbose_name='Notes')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
                ('workspace', models.ForeignKey(help_text='Изоляция данных по workspace', on_delete=django.db.models.deletion.CASCADE, related_name='customers', to='core.workspace', verbose_name='Workspace')),
            ],
            options={
                'verbose_name': 'Customer',
                'verbose_name_plural': 'Customers',
                'db_table': 'customers',
                'ordering': ['name'],
                'indexes': [
                    models.Index(fields=['workspace', 'status'], name='customers_workspace_status_idx'),
                    models.Index(fields=['name'], name='customers_name_idx'),
                ],
            },
        ),
    ]
