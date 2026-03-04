from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0016_alter_projectmember_options_alter_user_options_and_more'),
        ('saas', '0002_alter_plan_limits'),
        ('billing', '0008_alter_invoice_options_alter_subscription_options'),
    ]

    operations = [
        migrations.CreateModel(
            name='BillingAccount',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('active', 'Active'), ('suspended', 'Suspended'), ('archived', 'Archived')], default='active', max_length=20, verbose_name='Status')),
                ('currency', models.CharField(default='RUB', max_length=6, verbose_name='Currency')),
                ('timezone', models.CharField(default='Europe/Moscow', max_length=64, verbose_name='Timezone')),
                ('tax_profile', models.JSONField(blank=True, default=dict, verbose_name='Tax profile')),
                ('meta', models.JSONField(blank=True, default=dict, verbose_name='Meta')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='billing_accounts', to=settings.AUTH_USER_MODEL, verbose_name='Owner')),
                ('workspace', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='billing_account', to='core.workspace', verbose_name='Workspace')),
            ],
            options={
                'verbose_name': 'Billing account',
                'verbose_name_plural': 'Billing accounts',
                'db_table': 'billing_accounts',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='PlanVersion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(help_text='Внутренний код тарифа, например pro_monthly', max_length=64, verbose_name='Code')),
                ('name', models.CharField(max_length=128, verbose_name='Name')),
                ('version', models.PositiveIntegerField(default=1, verbose_name='Version')),
                ('interval', models.CharField(choices=[('month', 'Month'), ('year', 'Year')], default='month', max_length=10, verbose_name='Billing interval')),
                ('price', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12, verbose_name='Price')),
                ('currency', models.CharField(default='RUB', max_length=6, verbose_name='Currency')),
                ('limits_schema', models.JSONField(blank=True, default=dict, verbose_name='Limits schema')),
                ('features_schema', models.JSONField(blank=True, default=dict, verbose_name='Features schema')),
                ('is_active', models.BooleanField(default=True, verbose_name='Active')),
                ('effective_from', models.DateTimeField(default=django.utils.timezone.now, verbose_name='Effective from')),
                ('effective_to', models.DateTimeField(blank=True, null=True, verbose_name='Effective to')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
                ('saas_plan', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='billing_versions', to='saas.plan', verbose_name='Legacy SaaS plan')),
            ],
            options={
                'verbose_name': 'Plan version',
                'verbose_name_plural': 'Plan versions',
                'db_table': 'billing_plan_versions',
                'ordering': ['code', '-version'],
            },
        ),
        migrations.CreateModel(
            name='UsageMeter',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=64, unique=True, verbose_name='Code')),
                ('name', models.CharField(max_length=128, verbose_name='Name')),
                ('unit', models.CharField(help_text='Пример: count, gb, minute, request', max_length=32, verbose_name='Unit')),
                ('aggregation', models.CharField(choices=[('sum', 'Sum'), ('count', 'Count'), ('max', 'Max')], default='sum', max_length=16, verbose_name='Aggregation')),
                ('is_billable', models.BooleanField(default=True, verbose_name='Billable')),
                ('is_active', models.BooleanField(default=True, verbose_name='Active')),
                ('meta', models.JSONField(blank=True, default=dict, verbose_name='Meta')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
            ],
            options={
                'verbose_name': 'Usage meter',
                'verbose_name_plural': 'Usage meters',
                'db_table': 'billing_usage_meters',
                'ordering': ['code'],
            },
        ),
        migrations.CreateModel(
            name='BillingSubscription',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('trialing', 'Trialing'), ('active', 'Active'), ('past_due', 'Past due'), ('suspended', 'Suspended'), ('canceled', 'Canceled'), ('expired', 'Expired'), ('manual_hold', 'Manual hold')], default='trialing', max_length=20, verbose_name='Status')),
                ('current_period_start', models.DateTimeField(verbose_name='Current period start')),
                ('current_period_end', models.DateTimeField(verbose_name='Current period end')),
                ('trial_end', models.DateTimeField(blank=True, null=True, verbose_name='Trial end')),
                ('cancel_at_period_end', models.BooleanField(default=False, verbose_name='Cancel at period end')),
                ('canceled_at', models.DateTimeField(blank=True, null=True, verbose_name='Canceled at')),
                ('provider', models.CharField(blank=True, default='', max_length=32, verbose_name='Payment provider')),
                ('provider_subscription_id', models.CharField(blank=True, default='', max_length=255, verbose_name='Provider subscription id')),
                ('meta', models.JSONField(blank=True, default=dict, verbose_name='Meta')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
                ('account', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subscriptions_v2', to='billing.billingaccount', verbose_name='Billing account')),
                ('plan_version', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='subscriptions', to='billing.planversion', verbose_name='Plan version')),
            ],
            options={
                'verbose_name': 'Billing subscription',
                'verbose_name_plural': 'Billing subscriptions',
                'db_table': 'billing_subscriptions_v2',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='EntitlementOverride',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(help_text='Пример: features.payroll, limits.max_ai_agents', max_length=128, verbose_name='Key')),
                ('value', models.JSONField(blank=True, default=dict, verbose_name='Value')),
                ('is_enabled', models.BooleanField(default=True, verbose_name='Enabled')),
                ('reason', models.CharField(blank=True, default='', max_length=255, verbose_name='Reason')),
                ('expires_at', models.DateTimeField(blank=True, null=True, verbose_name='Expires at')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
                ('account', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='entitlement_overrides', to='billing.billingaccount', verbose_name='Billing account')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_entitlement_overrides', to=settings.AUTH_USER_MODEL, verbose_name='Created by')),
            ],
            options={
                'verbose_name': 'Entitlement override',
                'verbose_name_plural': 'Entitlement overrides',
                'db_table': 'billing_entitlement_overrides',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='SubscriptionItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('item_type', models.CharField(choices=[('plan', 'Plan'), ('addon', 'Addon')], default='plan', max_length=16, verbose_name='Item type')),
                ('code', models.CharField(max_length=64, verbose_name='Code')),
                ('quantity', models.PositiveIntegerField(default=1, verbose_name='Quantity')),
                ('unit_price', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12, verbose_name='Unit price')),
                ('included_units', models.DecimalField(decimal_places=3, default=Decimal('0'), max_digits=14, verbose_name='Included units')),
                ('overage_price', models.DecimalField(decimal_places=4, default=Decimal('0'), max_digits=12, verbose_name='Overage price')),
                ('is_active', models.BooleanField(default=True, verbose_name='Active')),
                ('meta', models.JSONField(blank=True, default=dict, verbose_name='Meta')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
                ('subscription', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='billing.billingsubscription', verbose_name='Subscription')),
            ],
            options={
                'verbose_name': 'Subscription item',
                'verbose_name_plural': 'Subscription items',
                'db_table': 'billing_subscription_items',
            },
        ),
        migrations.CreateModel(
            name='UsageRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.DecimalField(decimal_places=3, default=Decimal('0'), max_digits=14, verbose_name='Quantity')),
                ('occurred_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='Occurred at')),
                ('source', models.CharField(blank=True, default='', max_length=64, verbose_name='Source')),
                ('idempotency_key', models.CharField(blank=True, default='', max_length=128, verbose_name='Idempotency key')),
                ('meta', models.JSONField(blank=True, default=dict, verbose_name='Meta')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('account', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='usage_records', to='billing.billingaccount', verbose_name='Billing account')),
                ('meter', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='records', to='billing.usagemeter', verbose_name='Meter')),
            ],
            options={
                'verbose_name': 'Usage record',
                'verbose_name_plural': 'Usage records',
                'db_table': 'billing_usage_records',
                'ordering': ['-occurred_at', '-id'],
            },
        ),
        migrations.AddConstraint(
            model_name='planversion',
            constraint=models.UniqueConstraint(fields=('code', 'version'), name='unique_plan_version_per_code'),
        ),
        migrations.AddConstraint(
            model_name='usagerecord',
            constraint=models.UniqueConstraint(condition=models.Q(('idempotency_key', ''), _negated=True), fields=('account', 'meter', 'idempotency_key'), name='unique_usage_record_idempotency'),
        ),
        migrations.AddIndex(
            model_name='billingaccount',
            index=models.Index(fields=['status'], name='billing_acco_status_18f881_idx'),
        ),
        migrations.AddIndex(
            model_name='billingaccount',
            index=models.Index(fields=['owner'], name='billing_acco_owner_i_911dc8_idx'),
        ),
        migrations.AddIndex(
            model_name='planversion',
            index=models.Index(fields=['code', 'is_active'], name='billing_plan_code_8dd33e_idx'),
        ),
        migrations.AddIndex(
            model_name='usagemeter',
            index=models.Index(fields=['is_active', 'is_billable'], name='billing_usag_is_acti_5f7c7e_idx'),
        ),
        migrations.AddIndex(
            model_name='billingsubscription',
            index=models.Index(fields=['account', 'status'], name='billing_bil_account_a2cab9_idx'),
        ),
        migrations.AddIndex(
            model_name='billingsubscription',
            index=models.Index(fields=['current_period_end'], name='billing_bil_current_d43726_idx'),
        ),
        migrations.AddIndex(
            model_name='entitlementoverride',
            index=models.Index(fields=['account', 'key', 'is_enabled'], name='billing_ent_account_21100d_idx'),
        ),
        migrations.AddIndex(
            model_name='entitlementoverride',
            index=models.Index(fields=['expires_at'], name='billing_ent_expires_871972_idx'),
        ),
        migrations.AddIndex(
            model_name='subscriptionitem',
            index=models.Index(fields=['subscription', 'item_type'], name='billing_sub_subscription_87f476_idx'),
        ),
        migrations.AddIndex(
            model_name='subscriptionitem',
            index=models.Index(fields=['code', 'is_active'], name='billing_sub_code_24579f_idx'),
        ),
        migrations.AddIndex(
            model_name='usagerecord',
            index=models.Index(fields=['account', 'meter', 'occurred_at'], name='billing_usa_account_39437b_idx'),
        ),
        migrations.AddIndex(
            model_name='usagerecord',
            index=models.Index(fields=['source'], name='billing_usa_source_154f12_idx'),
        ),
    ]
