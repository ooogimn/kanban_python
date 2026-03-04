from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('billing', '0009_add_billing_v2_models'),
    ]

    operations = [
        migrations.CreateModel(
            name='PaymentWebhookEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(default='yookassa', max_length=32, verbose_name='Provider')),
                ('event_type', models.CharField(blank=True, default='', max_length=64, verbose_name='Event type')),
                ('event_id', models.CharField(max_length=255, verbose_name='Event id')),
                ('payload', models.JSONField(blank=True, default=dict, verbose_name='Payload')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processed', 'Processed'), ('failed', 'Failed')], default='pending', max_length=16, verbose_name='Status')),
                ('error_message', models.TextField(blank=True, default='', verbose_name='Error message')),
                ('processed_at', models.DateTimeField(blank=True, null=True, verbose_name='Processed at')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
            ],
            options={
                'verbose_name': 'Payment webhook event',
                'verbose_name_plural': 'Payment webhook events',
                'db_table': 'billing_payment_webhook_events',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='PaymentTransaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(choices=[('yookassa', 'YooKassa'), ('stripe', 'Stripe'), ('robokassa', 'Robokassa'), ('manual', 'Manual')], default='yookassa', max_length=32, verbose_name='Provider')),
                ('provider_payment_id', models.CharField(blank=True, default='', max_length=255, verbose_name='Provider payment id')),
                ('idempotency_key', models.CharField(blank=True, default='', max_length=128, verbose_name='Idempotency key')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('requires_action', 'Requires action'), ('waiting_for_capture', 'Waiting capture'), ('succeeded', 'Succeeded'), ('canceled', 'Canceled'), ('failed', 'Failed'), ('refunded', 'Refunded')], default='pending', max_length=32, verbose_name='Status')),
                ('amount', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=14, verbose_name='Amount')),
                ('currency', models.CharField(default='RUB', max_length=6, verbose_name='Currency')),
                ('description', models.CharField(blank=True, default='', max_length=255, verbose_name='Description')),
                ('confirmation_url', models.URLField(blank=True, default='', verbose_name='Confirmation URL')),
                ('raw_response', models.JSONField(blank=True, default=dict, verbose_name='Raw response')),
                ('meta', models.JSONField(blank=True, default=dict, verbose_name='Meta')),
                ('paid_at', models.DateTimeField(blank=True, null=True, verbose_name='Paid at')),
                ('canceled_at', models.DateTimeField(blank=True, null=True, verbose_name='Canceled at')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
                ('account', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payment_transactions', to='billing.billingaccount', verbose_name='Billing account')),
                ('invoice', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='payment_transactions', to='billing.invoice', verbose_name='Invoice')),
                ('subscription', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='payment_transactions', to='billing.billingsubscription', verbose_name='Billing subscription')),
            ],
            options={
                'verbose_name': 'Payment transaction',
                'verbose_name_plural': 'Payment transactions',
                'db_table': 'billing_payment_transactions',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='paymentwebhookevent',
            constraint=models.UniqueConstraint(fields=('provider', 'event_id'), name='unique_provider_event_id'),
        ),
        migrations.AddConstraint(
            model_name='paymenttransaction',
            constraint=models.UniqueConstraint(condition=models.Q(('provider_payment_id', ''), _negated=True), fields=('provider', 'provider_payment_id'), name='unique_provider_payment_id'),
        ),
        migrations.AddConstraint(
            model_name='paymenttransaction',
            constraint=models.UniqueConstraint(condition=models.Q(('idempotency_key', ''), _negated=True), fields=('account', 'provider', 'idempotency_key'), name='unique_account_provider_idempotency'),
        ),
        migrations.AddIndex(
            model_name='paymentwebhookevent',
            index=models.Index(fields=['provider', 'status'], name='billing_paym_provider_17016a_idx'),
        ),
        migrations.AddIndex(
            model_name='paymentwebhookevent',
            index=models.Index(fields=['event_type'], name='billing_paym_event_t_b3b798_idx'),
        ),
        migrations.AddIndex(
            model_name='paymenttransaction',
            index=models.Index(fields=['account', 'status'], name='billing_paym_account_7cbfe2_idx'),
        ),
        migrations.AddIndex(
            model_name='paymenttransaction',
            index=models.Index(fields=['provider', 'status'], name='billing_paym_provider_ba9846_idx'),
        ),
    ]
