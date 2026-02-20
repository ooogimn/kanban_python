"""
Serializers for finance app.
"""
from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from apps.core.models import User, Workspace
from apps.todo.models import Project, WorkItem

from .models import BankConnection, Category, Transaction, Wallet


class UserShortSerializer(serializers.ModelSerializer):
    """Краткий сериализатор пользователя."""

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']


class WalletSerializer(serializers.ModelSerializer):
    """Сериализатор кошелька."""

    owner = serializers.PrimaryKeyRelatedField(read_only=True)
    workspace = serializers.PrimaryKeyRelatedField(
        queryset=Workspace.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = Wallet
        fields = [
            'id', 'name', 'type', 'currency', 'balance',
            'owner', 'workspace', 'is_active',
            'last_reconciled_at', 'created_at', 'updated_at',
        ]
        read_only_fields = ['balance', 'created_at', 'updated_at']


class CategorySerializer(serializers.ModelSerializer):
    """Сериализатор категории."""

    workspace = serializers.PrimaryKeyRelatedField(
        queryset=Workspace.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'type', 'pnl_group',
            'workspace', 'parent', 'color', 'created_at',
        ]
        read_only_fields = ['created_at']


class BankConnectionSerializer(serializers.ModelSerializer):
    """Сериализатор банковской интеграции."""

    api_token = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = BankConnection
        fields = [
            'id', 'workspace', 'name', 'bank_type',
            'linked_wallet', 'api_token', 'last_synced_at', 'created_at',
        ]
        read_only_fields = ['last_synced_at', 'created_at']


class WalletShortSerializer(serializers.ModelSerializer):
    """Короткий вид кошелька для транзакций."""

    class Meta:
        model = Wallet
        fields = ['id', 'name', 'type', 'currency']
        read_only_fields = fields


class CategoryShortSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'type', 'pnl_group']
        read_only_fields = fields


class TransactionSerializer(serializers.ModelSerializer):
    """Сериализатор транзакции."""

    created_by = UserShortSerializer(read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    workspace = serializers.PrimaryKeyRelatedField(read_only=True)
    source_wallet = WalletShortSerializer(read_only=True)
    destination_wallet = WalletShortSerializer(read_only=True)
    category = CategoryShortSerializer(read_only=True)
    workitem = serializers.PrimaryKeyRelatedField(
        source='related_workitem',
        read_only=True
    )
    workitem_title = serializers.CharField(
        source='related_workitem.title',
        read_only=True
    )
    has_receipt = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            'id', 'type', 'status', 'amount', 'currency', 'description',
            'project', 'project_name', 'workspace',
            'workitem', 'workitem_title',
            'source_wallet', 'destination_wallet',
            'category', 'counterparty',
            'transfer_group_id', 'has_receipt',
            'created_by', 'created_at',
        ]
        read_only_fields = fields

    def get_has_receipt(self, obj):
        return bool(obj.receipt)


class TransactionMetadataSerializer(serializers.ModelSerializer):
    """Сериализатор для частичного обновления описания/категории."""

    class Meta:
        model = Transaction
        fields = ['description', 'category']
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True, 'allow_null': True},
            'category': {'required': False, 'allow_null': True},
        }

class ProjectBudgetSummarySerializer(serializers.Serializer):
    """Сериализатор сводки бюджета проекта."""
    
    project_id = serializers.IntegerField()
    project_name = serializers.CharField()
    budget_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    budget_spent = serializers.DecimalField(max_digits=12, decimal_places=2)
    remaining = serializers.DecimalField(max_digits=12, decimal_places=2)
    spent_percent = serializers.FloatField()
    transactions_count = serializers.IntegerField()
    income_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    expense_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    hold_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    
    @classmethod
    def from_project(cls, project):
        """Создание сводки из проекта."""
        budget_total = project.budget_total or project.budget or Decimal('0')
        budget_spent = project.budget_spent or Decimal('0')
        remaining = budget_total - budget_spent
        
        # Процент израсходования
        if budget_total > 0:
            spent_percent = float(budget_spent / budget_total * 100)
        else:
            spent_percent = 0.0
        
        # Агрегация транзакций (модель Transaction: type = deposit/spend/hold/release, без status)
        from .models import Transaction
        
        transactions = Transaction.objects.filter(
            project=project,
            status=Transaction.STATUS_COMPLETED,
        )
        transactions_count = transactions.count()
        
        income_total = transactions.filter(
            type=Transaction.TYPE_DEPOSIT
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        expense_total = transactions.filter(
            type=Transaction.TYPE_SPEND
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        hold_total = transactions.filter(
            type=Transaction.TYPE_HOLD
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        return {
            'project_id': project.id,
            'project_name': project.name,
            'budget_total': budget_total,
            'budget_spent': budget_spent,
            'remaining': remaining,
            'spent_percent': round(spent_percent, 1),
            'transactions_count': transactions_count,
            'income_total': income_total,
            'expense_total': expense_total,
            'hold_total': hold_total,
        }


class DepositRequestSerializer(serializers.Serializer):
    wallet = serializers.PrimaryKeyRelatedField(queryset=Wallet.objects.all())
    amount = serializers.DecimalField(max_digits=19, decimal_places=2)
    description = serializers.CharField(required=False, allow_blank=True)
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        required=False,
        allow_null=True
    )
    workitem = serializers.PrimaryKeyRelatedField(
        queryset=WorkItem.objects.all(),
        required=False,
        allow_null=True
    )
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        required=False,
        allow_null=True
    )


class SpendRequestSerializer(serializers.Serializer):
    wallet = serializers.PrimaryKeyRelatedField(
        queryset=Wallet.objects.all(),
        required=False,
        allow_null=True
    )
    amount = serializers.DecimalField(max_digits=19, decimal_places=2)
    description = serializers.CharField(required=False, allow_blank=True)
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        required=False,
        allow_null=True
    )
    workitem = serializers.PrimaryKeyRelatedField(
        queryset=WorkItem.objects.all(),
        required=False,
        allow_null=True
    )
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        required=False,
        allow_null=True
    )
    allow_overdraft = serializers.BooleanField(default=False)


class TransferRequestSerializer(serializers.Serializer):
    from_wallet = serializers.PrimaryKeyRelatedField(queryset=Wallet.objects.all())
    to_wallet = serializers.PrimaryKeyRelatedField(queryset=Wallet.objects.all())
    amount = serializers.DecimalField(max_digits=19, decimal_places=2)
    target_amount = serializers.DecimalField(
        max_digits=19,
        decimal_places=2,
        required=False,
        allow_null=True
    )
    description = serializers.CharField(required=False, allow_blank=True)
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        required=False,
        allow_null=True
    )
    destination_category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        required=False,
        allow_null=True
    )
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        required=False,
        allow_null=True
    )
    workitem = serializers.PrimaryKeyRelatedField(
        queryset=WorkItem.objects.all(),
        required=False,
        allow_null=True
    )
    allow_overdraft = serializers.BooleanField(default=False)
