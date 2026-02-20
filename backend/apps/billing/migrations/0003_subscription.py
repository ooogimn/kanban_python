# Phase 0: Subscription (Директор / владелец аккаунта)

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0002_rename_invoices_project_idx_invoices_project_bebff2_idx_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Subscription',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('plan', models.CharField(
                    choices=[('free', 'Free'), ('pro', 'Pro'), ('enterprise', 'Enterprise')],
                    default='free',
                    max_length=20,
                    verbose_name='Plan',
                )),
                ('is_active', models.BooleanField(default=True, verbose_name='Active')),
                ('max_system_contacts', models.PositiveIntegerField(
                    default=0,
                    help_text='Лимит системных контактов по тарифу (0 = без лимита для enterprise)',
                    verbose_name='Max system contacts',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='subscription',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Owner (Director)',
                )),
            ],
            options={
                'verbose_name': 'Subscription',
                'verbose_name_plural': 'Subscriptions',
                'db_table': 'subscriptions',
            },
        ),
    ]
