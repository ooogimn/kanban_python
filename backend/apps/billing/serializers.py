"""
Billing serializers.
"""
from rest_framework import serializers

from .models import Invoice
from apps.todo.models import Project
from apps.core.models import WorkspaceMember


class InvoiceSerializer(serializers.ModelSerializer):
    """Сериализатор счёта."""

    project_name = serializers.CharField(source='project.name', read_only=True)
    customer_name = serializers.CharField(
        source='customer.name', read_only=True, allow_null=True
    )

    class Meta:
        model = Invoice
        fields = [
            'id',
            'project',
            'project_name',
            'customer',
            'customer_name',
            'number',
            'status',
            'date_issue',
            'date_due',
            'amount_total',
            'pdf_file',
            'line_items',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'number', 'status', 'amount_total', 'pdf_file',
            'line_items', 'created_at', 'updated_at',
        ]


class InvoiceCreateSerializer(serializers.Serializer):
    """Создание черновика счёта."""

    project_id = serializers.IntegerField()
    date_start = serializers.DateField()
    date_end = serializers.DateField()

    def validate(self, data):
        if data['date_end'] < data['date_start']:
            raise serializers.ValidationError(
                {'date_end': 'Дата окончания не может быть раньше даты начала.'}
            )
        return data


class BillingMeResponseSerializer(serializers.Serializer):
    account_id = serializers.IntegerField(allow_null=True)
    workspace_id = serializers.IntegerField(allow_null=True)
    workspace_name = serializers.CharField(allow_blank=True, allow_null=True)
    account_status = serializers.CharField(allow_blank=True, allow_null=True)
    account_currency = serializers.CharField(allow_blank=True, allow_null=True)
    account_timezone = serializers.CharField(allow_blank=True, allow_null=True)
    subscription_id = serializers.IntegerField(allow_null=True)
    plan_code = serializers.CharField(allow_blank=True, allow_null=True)
    plan_name = serializers.CharField(allow_blank=True, allow_null=True)
    plan_interval = serializers.CharField(allow_blank=True, allow_null=True)
    plan_price = serializers.CharField(allow_blank=True, allow_null=True)
    plan_currency = serializers.CharField(allow_blank=True, allow_null=True)
    plan_badge = serializers.CharField(allow_blank=True, allow_null=True)
    status = serializers.CharField(allow_blank=True, allow_null=True)
    cancel_at_period_end = serializers.BooleanField(required=False)
    trial_end = serializers.DateTimeField(allow_null=True, required=False)
    provider = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    provider_subscription_id = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    period_start = serializers.DateTimeField(allow_null=True)
    period_end = serializers.DateTimeField(allow_null=True)
    next_billing_at = serializers.DateTimeField(allow_null=True, required=False)
    provider_display = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    status_flags = serializers.JSONField(required=False)
    entitlement = serializers.JSONField(required=False)
    entitlements = serializers.JSONField(required=False)


class BillingUsageResponseSerializer(serializers.Serializer):
    period_start = serializers.DateTimeField()
    period_end = serializers.DateTimeField()
    meters = serializers.JSONField()
    totals = serializers.JSONField()
    entitlements = serializers.JSONField()


class UsageRecordCreateSerializer(serializers.Serializer):
    meter_code = serializers.CharField(max_length=64)
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3)
    source = serializers.CharField(max_length=64, required=False, allow_blank=True, default='')
    idempotency_key = serializers.CharField(max_length=128, required=False, allow_blank=True, default='')
    occurred_at = serializers.DateTimeField(required=False)
    meta = serializers.JSONField(required=False, default=dict)

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('quantity должен быть больше 0.')
        return value


class UsageRecordResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    status = serializers.CharField()
    meter_code = serializers.CharField()
    quantity = serializers.CharField()
    occurred_at = serializers.DateTimeField()
    source = serializers.CharField()
    idempotency_key = serializers.CharField()


class BillingPaymentSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    amount = serializers.CharField()
    currency = serializers.CharField()
    source = serializers.CharField()
    status = serializers.CharField()
    description = serializers.CharField(allow_blank=True)


class BillingInvoiceListSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    number = serializers.CharField()
    status = serializers.CharField()
    date_issue = serializers.DateField()
    date_due = serializers.DateField()
    amount_total = serializers.CharField()
    pdf_url = serializers.CharField(allow_blank=True, allow_null=True)
    project_name = serializers.CharField(allow_blank=True, allow_null=True)
    customer_name = serializers.CharField(allow_blank=True, allow_null=True)


class BillingTimelineItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    occurred_at = serializers.DateTimeField()
    kind = serializers.CharField()
    title = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    amount = serializers.CharField(allow_blank=True, allow_null=True)
    currency = serializers.CharField(allow_blank=True, allow_null=True)
    meta = serializers.JSONField()


class BillingReadinessSerializer(serializers.Serializer):
    ready = serializers.BooleanField()
    mode = serializers.CharField()
    checks = serializers.JSONField()
    problems = serializers.JSONField()
    account_id = serializers.IntegerField(allow_null=True)
    subscription_v2_id = serializers.IntegerField(allow_null=True)
    legacy_subscription_id = serializers.IntegerField(allow_null=True)


class YookassaPaymentIntentCreateSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField(required=False)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    currency = serializers.CharField(required=False, default='RUB')
    description = serializers.CharField(required=False, allow_blank=True, default='')
    return_url = serializers.URLField(required=False)
    idempotency_key = serializers.CharField(required=False, allow_blank=True, default='')
    meta = serializers.JSONField(required=False, default=dict)

    def validate(self, attrs):
        if attrs.get('plan_id') is None and attrs.get('amount') is None:
            raise serializers.ValidationError('Нужно передать plan_id или amount.')
        return attrs

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('amount должен быть больше 0.')
        return value


class YookassaPaymentIntentResponseSerializer(serializers.Serializer):
    transaction_id = serializers.IntegerField()
    provider = serializers.CharField()
    provider_payment_id = serializers.CharField(allow_blank=True)
    status = serializers.CharField()
    amount = serializers.CharField()
    currency = serializers.CharField()
    confirmation_url = serializers.CharField(allow_blank=True)
    idempotency_key = serializers.CharField(allow_blank=True)
    expires_at = serializers.DateTimeField(allow_null=True, required=False)


class YandexPayCreatePaymentSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField(required=True)
    idempotency_key = serializers.CharField(required=False, allow_blank=True, default='')
    return_url = serializers.URLField(required=False)


class YandexPayCreatePaymentResponseSerializer(serializers.Serializer):
    transaction_id = serializers.IntegerField()
    provider = serializers.CharField()
    provider_payment_id = serializers.CharField(allow_blank=True)
    status = serializers.CharField()
    amount = serializers.CharField()
    currency = serializers.CharField()
    confirmation_url = serializers.CharField(allow_blank=True)
    idempotency_key = serializers.CharField(allow_blank=True)
