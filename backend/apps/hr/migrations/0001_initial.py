# Phase 1: Contact

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0007_workspace_progress_health'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Contact',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('super_group', models.CharField(
                    choices=[('SYSTEM', 'System (Staff)'), ('NON_SYSTEM', 'Non-system (External)')],
                    default='SYSTEM',
                    max_length=20,
                    verbose_name='Super group',
                )),
                ('group', models.CharField(
                    default='staff',
                    help_text='Категория: staff, employee, client, contractor…',
                    max_length=64,
                    verbose_name='Group',
                )),
                ('hr_role', models.CharField(
                    blank=True,
                    help_text='Организационная роль: Worker, Lead, Team Lead…',
                    max_length=64,
                    verbose_name='HR role',
                )),
                ('tariff_rate', models.DecimalField(
                    blank=True,
                    decimal_places=2,
                    max_digits=12,
                    null=True,
                    verbose_name='Tariff rate',
                )),
                ('currency', models.CharField(
                    blank=True,
                    default='RUB',
                    max_length=3,
                    verbose_name='Currency',
                )),
                ('first_name', models.CharField(blank=True, max_length=128, verbose_name='First name')),
                ('last_name', models.CharField(blank=True, max_length=128, verbose_name='Last name')),
                ('email', models.EmailField(blank=True, max_length=254, verbose_name='Email')),
                ('phone', models.CharField(blank=True, max_length=32, verbose_name='Phone')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
                ('workspace', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='contacts',
                    to='core.workspace',
                    verbose_name='Workspace',
                )),
                ('user', models.ForeignKey(
                    blank=True,
                    help_text='Если заполнено — контакт имеет системный аккаунт',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='hr_contacts',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='User',
                )),
                ('guarantor', models.ForeignKey(
                    blank=True,
                    help_text='Поручитель v1 — действует от имени контакта',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='guaranteed_contacts',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Guarantor',
                )),
            ],
            options={
                'verbose_name': 'Contact',
                'verbose_name_plural': 'Contacts',
                'db_table': 'hr_contacts',
                'ordering': ['super_group', 'last_name', 'first_name'],
            },
        ),
        migrations.AddIndex(
            model_name='contact',
            index=models.Index(fields=['workspace'], name='hr_contacts_workspa_idx'),
        ),
        migrations.AddIndex(
            model_name='contact',
            index=models.Index(fields=['super_group'], name='hr_contacts_super_g_idx'),
        ),
        migrations.AddIndex(
            model_name='contact',
            index=models.Index(fields=['user'], name='hr_contacts_user_id_idx'),
        ),
    ]
