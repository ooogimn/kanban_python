# SaaS: Plan model

from decimal import Decimal
from django.db import migrations, models


def default_limits():
    return {
        'max_system_contacts': 10,
        'max_ai_agents': 1,
        'features': {'hr': True, 'payroll': False, 'ai_analyst': False},
    }


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Plan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='Free, Pro, Enterprise', max_length=64, verbose_name='Name')),
                ('price', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12, verbose_name='Price')),
                ('currency', models.CharField(default='RUB', max_length=6, verbose_name='Currency')),
                ('limits', models.JSONField(default=default_limits, help_text='max_system_contacts, max_ai_agents, features', verbose_name='Limits')),
                ('is_active', models.BooleanField(default=True, verbose_name='Active')),
                ('is_default', models.BooleanField(default=False, help_text='План по умолчанию для новых подписок', verbose_name='Default plan')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
            ],
            options={
                'verbose_name': 'Plan',
                'verbose_name_plural': 'Plans',
                'db_table': 'saas_plans',
                'ordering': ['price'],
            },
        ),
    ]
