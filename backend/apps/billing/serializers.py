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
