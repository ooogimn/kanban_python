# User.hide_ads + UserEvent for analytics

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0012_add_force_business_plan'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='hide_ads',
            field=models.BooleanField(
                default=False,
                help_text='Отключить показ рекламы для пользователя (ручная настройка в SaaS)',
                verbose_name='Hide ads',
            ),
        ),
        migrations.CreateModel(
            name='UserEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(
                    choices=[
                        ('login', 'Login'),
                        ('ads_off', 'Ads disabled'),
                        ('ads_on', 'Ads enabled'),
                        ('business_off', 'Business plan disabled'),
                        ('business_on', 'Business plan enabled'),
                        ('payment', 'Payment'),
                    ],
                    max_length=32,
                    verbose_name='Event type',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('details', models.JSONField(
                    blank=True,
                    default=dict,
                    help_text='Доп. данные: подписка, способ оплаты и т.д.',
                    verbose_name='Details',
                )),
                ('amount', models.DecimalField(
                    blank=True,
                    decimal_places=2,
                    help_text='Сумма платежа (для event_type=payment)',
                    max_digits=12,
                    null=True,
                    verbose_name='Amount',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='events',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='User',
                )),
            ],
            options={
                'verbose_name': 'User event',
                'verbose_name_plural': 'User events',
                'db_table': 'user_events',
                'ordering': ['-created_at'],
            },
        ),
    ]
