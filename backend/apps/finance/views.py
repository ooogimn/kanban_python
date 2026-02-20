"""
Views for finance app — Ledger & Holds API (Task 2.2).
"""
from decimal import Decimal

from django.db.models import Q
from django.http import FileResponse, Http404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.auth.permissions import IsDirectorOrManager
from apps.billing.services import SubscriptionService
from apps.core.models import WorkspaceMember
from apps.todo.models import Project, WorkItem

from .models import BankConnection, Category, Transaction, Wallet
from .serializers import (
    BankConnectionSerializer,
    CategorySerializer,
    DepositRequestSerializer,
    ProjectBudgetSummarySerializer,
    SpendRequestSerializer,
    TransactionMetadataSerializer,
    TransactionSerializer,
    TransferRequestSerializer,
    WalletSerializer,
)
from .services import (
    FinanceService,
    FinanceStatsService,
    InsufficientFundsError,
    TransactionService,
)


class WorkspaceAccessMixin:
    """Вспомогательные методы для проверки доступа к workspace."""

    def _workspace_ids(self, user):
        cache_attr = '_workspace_ids_cache'
        if not hasattr(self, cache_attr):
            setattr(
                self,
                cache_attr,
                list(
                    WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
                ),
            )
        return getattr(self, cache_attr)

    def _is_workspace_manager(self, workspace, user=None):
        if not workspace:
            return False
        user = user or getattr(self, 'request', None)
        if hasattr(user, 'user'):
            user = user.user
        if user is None:
            return False
        if getattr(user, 'is_superuser', False):
            return True
        return WorkspaceMember.objects.filter(
            user=user,
            workspace=workspace,
            role__in=[WorkspaceMember.ROLE_OWNER, WorkspaceMember.ROLE_ADMIN],
        ).exists()

    def _ensure_wallet_access(self, wallet: Wallet, write=False):
        user = self.request.user
        if wallet.owner:
            if wallet.owner_id != user.id:
                raise Http404
            return
        if wallet.workspace and wallet.workspace_id in self._workspace_ids(user):
            if write and not self._is_workspace_manager(wallet.workspace, user):
                raise PermissionDenied('Недостаточно прав для управления кошельком workspace.')
            return
        raise Http404


class TransactionViewSet(WorkspaceAccessMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet для транзакций (ReadOnly — Immutable Ledger).

    Создание транзакций происходит через кастомные actions (deposit / spend / transfer).
    """

    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = [
        'workspace', 'project', 'type', 'status',
        'related_workitem', 'source_wallet', 'destination_wallet', 'category',
    ]
    ordering_fields = ['created_at', 'amount']
    ordering = ['-created_at']
    search_fields = ['description']

    def get_queryset(self):
        user = self.request.user
        qs = Transaction.objects.select_related(
            'project',
            'workspace',
            'related_workitem',
            'source_wallet',
            'destination_wallet',
            'category',
            'created_by',
        )
        if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
            return qs

        workspace_ids = self._workspace_ids(user)
        personal_filter = (
            Q(created_by=user) |
            Q(source_wallet__owner=user) |
            Q(destination_wallet__owner=user)
        )
        workspace_filter = Q()
        if workspace_ids:
            workspace_filter = Q(workspace_id__in=workspace_ids)
        return qs.filter(workspace_filter | personal_filter).distinct()

    def _has_project_access(self, project):
        user = self.request.user
        if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
            return True
        return WorkspaceMember.objects.filter(
            user=user,
            workspace=project.workspace
        ).exists()

    def _validate_category_scope(self, *, category=None, wallet=None, project=None):
        if not category:
            return
        category_workspace = category.workspace_id
        if not category_workspace:
            return
        target_workspace = None
        if wallet and wallet.workspace_id:
            target_workspace = wallet.workspace_id
        elif project and getattr(project, 'workspace_id', None):
            target_workspace = project.workspace_id
        if target_workspace and category_workspace != target_workspace:
            raise ValidationError('Категория принадлежит другому workspace.')

    @action(detail=False, methods=['get'], url_path='balance/(?P<project_id>[^/.]+)')
    def balance(self, request, project_id=None):
        """
        GET /api/v1/finance/transactions/balance/{project_id}/
        
        Получение текущего баланса проекта.
        """
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if not self._has_project_access(project):
            return Response(
                {'error': 'No access to this project'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        balance = FinanceService.get_project_balance(project.id)
        return Response(balance)
    
    @action(detail=False, methods=['post'])
    def deposit(self, request):
        """
        POST /api/v1/finance/transactions/deposit/
        
        Пополнение бюджета проекта (только Admin/Manager).
        
        Body: {
            "project_id": int,
            "amount": Decimal,
            "description": str (optional)
        }
        """
        serializer = DepositRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        wallet = serializer.validated_data['wallet']
        try:
            self._ensure_wallet_access(wallet, write=True)
        except PermissionDenied as exc:
            return Response({'error': str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except Http404:
            raise

        project = serializer.validated_data.get('project')
        if project and not self._has_project_access(project):
            return Response({'error': 'No access to this project'}, status=status.HTTP_403_FORBIDDEN)
        self._validate_category_scope(
            category=serializer.validated_data.get('category'),
            wallet=wallet,
            project=project,
        )

        tx = TransactionService.create_deposit(
            wallet=wallet,
            amount=serializer.validated_data['amount'],
            description=serializer.validated_data.get('description', ''),
            project=project,
            workitem=serializer.validated_data.get('workitem'),
            category=serializer.validated_data.get('category'),
            created_by=request.user,
        )
        data = self.get_serializer(tx).data
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def spend(self, request):
        serializer = SpendRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        wallet = serializer.validated_data.get('wallet')
        if wallet:
            try:
                self._ensure_wallet_access(wallet, write=True)
            except PermissionDenied as exc:
                return Response({'error': str(exc)}, status=status.HTTP_403_FORBIDDEN)
            except Http404:
                raise
        project = serializer.validated_data.get('project')
        if project and not self._has_project_access(project):
            return Response({'error': 'No access to this project'}, status=status.HTTP_403_FORBIDDEN)
        self._validate_category_scope(
            category=serializer.validated_data.get('category'),
            wallet=wallet,
            project=project,
        )

        tx = TransactionService.create_spend(
            wallet=wallet,
            amount=serializer.validated_data['amount'],
            description=serializer.validated_data.get('description', ''),
            project=project,
            workitem=serializer.validated_data.get('workitem'),
            category=serializer.validated_data.get('category'),
            allow_overdraft=serializer.validated_data.get('allow_overdraft', False),
            created_by=request.user,
        )
        data = self.get_serializer(tx).data
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def transfer(self, request):
        serializer = TransferRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from_wallet = serializer.validated_data['from_wallet']
        to_wallet = serializer.validated_data['to_wallet']
        try:
            self._ensure_wallet_access(from_wallet, write=True)
            self._ensure_wallet_access(to_wallet, write=True)
        except PermissionDenied as exc:
            return Response({'error': str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except Http404:
            raise

        project = serializer.validated_data.get('project')
        if project and not self._has_project_access(project):
            return Response({'error': 'No access to this project'}, status=status.HTTP_403_FORBIDDEN)
        self._validate_category_scope(
            category=serializer.validated_data.get('category'),
            wallet=from_wallet,
            project=project,
        )
        self._validate_category_scope(
            category=serializer.validated_data.get('destination_category'),
            wallet=to_wallet,
            project=project,
        )

        try:
            out_tx, in_tx = TransactionService.create_transfer(
                from_wallet=from_wallet,
                to_wallet=to_wallet,
                amount=serializer.validated_data['amount'],
                target_amount=serializer.validated_data.get('target_amount'),
                description=serializer.validated_data.get('description', ''),
                category=serializer.validated_data.get('category'),
                destination_category=serializer.validated_data.get('destination_category'),
                project=project,
                workitem=serializer.validated_data.get('workitem'),
                allow_overdraft=serializer.validated_data.get('allow_overdraft', False),
                created_by=request.user,
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except InsufficientFundsError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        serializer_out = self.get_serializer(out_tx)
        serializer_in = self.get_serializer(in_tx)
        return Response(
            {'out': serializer_out.data, 'in': serializer_in.data},
            status=status.HTTP_201_CREATED,
        )
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsDirectorOrManager])
    def hold(self, request):
        """
        POST /api/v1/finance/transactions/hold/
        
        Заморозка средств под задачу.
        
        Body: {
            "workitem_id": int,
            "amount": Decimal,
            "description": str (optional)
        }
        """
        workitem_id = request.data.get('workitem_id')
        amount = request.data.get('amount')
        description = request.data.get('description', '')
        
        if not workitem_id or not amount:
            return Response(
                {'error': 'workitem_id and amount are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            workitem = WorkItem.objects.select_related('project').get(pk=workitem_id)
            amount = Decimal(str(amount))
        except WorkItem.DoesNotExist:
            return Response(
                {'error': 'WorkItem not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid amount'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not self._has_project_access(workitem.project):
            return Response(
                {'error': 'No access to this project'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            transaction_obj = FinanceService.create_hold(
                project=workitem.project,
                amount=amount,
                workitem=workitem,
                user=request.user,
                description=description
            )
            serializer = self.get_serializer(transaction_obj)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except InsufficientFundsError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsDirectorOrManager])
    def commit(self, request):
        """
        POST /api/v1/finance/transactions/commit/
        
        Commit hold: превращение замороженных средств в потраченные.
        
        Body: {
            "workitem_id": int,
            "actual_amount": Decimal,
            "description": str (optional)
        }
        """
        workitem_id = request.data.get('workitem_id')
        actual_amount = request.data.get('actual_amount')
        description = request.data.get('description', '')
        
        if not workitem_id or actual_amount is None:
            return Response(
                {'error': 'workitem_id and actual_amount are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            workitem = WorkItem.objects.select_related('project').get(pk=workitem_id)
            actual_amount = Decimal(str(actual_amount))
        except WorkItem.DoesNotExist:
            return Response(
                {'error': 'WorkItem not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid actual_amount'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not self._has_project_access(workitem.project):
            return Response(
                {'error': 'No access to this project'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        transactions = FinanceService.commit_hold(
            workitem=workitem,
            actual_amount=actual_amount,
            user=request.user,
            description=description
        )
        
        serializer = self.get_serializer(transactions, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='receipt')
    def download_receipt(self, request, pk=None):
        transaction = self.get_object()
        if not transaction.receipt:
            raise Http404
        file_handle = transaction.receipt.open('rb')
        filename = transaction.receipt.name.rsplit('/', 1)[-1]
        response = FileResponse(file_handle, as_attachment=True, filename=filename)
        return response

    @action(detail=True, methods=['post'], url_path='receipt/upload', parser_classes=[MultiPartParser, FormParser])
    def upload_receipt(self, request, pk=None):
        transaction = self.get_object()
        receipt = request.FILES.get('receipt')
        if not receipt:
            return Response({'error': 'Файл receipt обязателен'}, status=status.HTTP_400_BAD_REQUEST)
        if transaction.receipt:
            transaction.receipt.delete(save=False)
        transaction.receipt.save(receipt.name, receipt, save=False)
        Transaction.objects.filter(pk=transaction.pk).update(receipt=transaction.receipt.name)
        transaction.refresh_from_db()
        serializer = TransactionSerializer(transaction, context=self.get_serializer_context())
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], url_path='metadata')
    def metadata(self, request, pk=None):
        transaction = self.get_object()
        serializer = TransactionMetadataSerializer(transaction, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_data = {k: v for k, v in serializer.validated_data.items()}
        if update_data:
            Transaction.objects.filter(pk=transaction.pk).update(**update_data)
            transaction.refresh_from_db()
        return Response(TransactionSerializer(transaction, context=self.get_serializer_context()).data)


class WalletViewSet(WorkspaceAccessMixin, viewsets.ModelViewSet):
    """CRUD по кошелькам."""

    serializer_class = WalletSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = ['type', 'currency', 'workspace', 'is_active']
    search_fields = ['name']
    ordering = ['name']

    def get_queryset(self):
        user = self.request.user
        qs = Wallet.objects.select_related('owner', 'workspace')
        if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
            return qs
        workspace_ids = self._workspace_ids(user)
        return qs.filter(
            Q(owner=user) | Q(workspace_id__in=workspace_ids)
        ).distinct()

    def perform_create(self, serializer):
        workspace = serializer.validated_data.get('workspace')
        if workspace:
            if not self._is_workspace_manager(workspace):
                raise PermissionDenied('Недостаточно прав для кошелька workspace.')
            serializer.save(owner=None)
        else:
            serializer.save(owner=self.request.user, workspace=None)

    def perform_update(self, serializer):
        instance = self.get_object()
        workspace = serializer.validated_data.get('workspace', instance.workspace)
        if workspace != instance.workspace:
            raise ValidationError('Нельзя менять привязку кошелька.')
        if workspace and not self._is_workspace_manager(workspace):
            raise PermissionDenied('Недостаточно прав для кошелька workspace.')
        serializer.save(owner=instance.owner, workspace=workspace)

    def perform_destroy(self, instance):
        self._ensure_wallet_access(instance, write=True)
        instance.delete()


class CategoryViewSet(WorkspaceAccessMixin, viewsets.ModelViewSet):
    """Управление категориями расходов/доходов."""

    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = ['workspace', 'type', 'pnl_group']
    search_fields = ['name']
    ordering = ['name']

    def get_queryset(self):
        user = self.request.user
        qs = Category.objects.all()
        if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
            return qs
        workspace_ids = self._workspace_ids(user)
        return qs.filter(Q(workspace__isnull=True) | Q(workspace_id__in=workspace_ids))

    def perform_create(self, serializer):
        workspace = serializer.validated_data.get('workspace')
        if workspace and not self._is_workspace_manager(workspace):
            raise PermissionDenied('Недостаточно прав для создания категории в workspace.')
        serializer.save()

    def perform_update(self, serializer):
        workspace = serializer.validated_data.get('workspace')
        if workspace and not self._is_workspace_manager(workspace):
            raise PermissionDenied('Недостаточно прав.')
        serializer.save()


class BankConnectionViewSet(WorkspaceAccessMixin, viewsets.ModelViewSet):
    """Настройки банковских подключений."""

    serializer_class = BankConnectionSerializer
    permission_classes = [IsAuthenticated, IsDirectorOrManager]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['workspace', 'bank_type']

    def get_queryset(self):
        user = self.request.user
        qs = BankConnection.objects.select_related('workspace', 'linked_wallet')
        if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
            return qs
        workspace_ids = self._workspace_ids(user)
        return qs.filter(workspace_id__in=workspace_ids)

    def perform_create(self, serializer):
        workspace = serializer.validated_data['workspace']
        if not self._is_workspace_manager(workspace):
            raise PermissionDenied('Недостаточно прав на workspace.')
        serializer.save()

    def perform_update(self, serializer):
        workspace = serializer.validated_data.get('workspace', serializer.instance.workspace)
        if not self._is_workspace_manager(workspace):
            raise PermissionDenied('Недостаточно прав на workspace.')
        serializer.save()


class ProjectBudgetViewSet(viewsets.ViewSet):
    """
    ViewSet для бюджета проектов.
    
    GET /finance/projects/{id}/summary/ — сводка бюджета проекта.
    Чтение доступно любому аутентифицированному пользователю с доступом к проекту
    (участник workspace, суперпользователь или staff). Запись транзакций — только Director/Manager.
    """
    
    permission_classes = [IsAuthenticated]
    
    def _has_project_access(self, project):
        """Проверка доступа пользователя к проекту. Суперпользователь и staff видят все проекты."""
        user = self.request.user
        if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
            return True
        return WorkspaceMember.objects.filter(
            user=user,
            workspace=project.workspace
        ).exists()
    
    @action(detail=True, methods=['get'], url_path='summary')
    def summary(self, request, pk=None):
        """
        GET /finance/projects/{id}/summary/
        
        Возвращает сводку бюджета проекта:
        - budget_total: общий бюджет
        - budget_spent: израсходовано
        - remaining: остаток
        - spent_percent: процент израсходования
        - transactions_count: количество транзакций
        - income_total: сумма доходов
        - expense_total: сумма расходов
        - hold_total: сумма замороженных средств
        """
        try:
            project = Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return Response(
                {'error': 'Проект не найден'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if not self._has_project_access(project):
            return Response(
                {'error': 'У вас нет доступа к этому проекту'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        summary_data = ProjectBudgetSummarySerializer.from_project(project)
        serializer = ProjectBudgetSummarySerializer(data=summary_data)
        serializer.is_valid()
        
        return Response(summary_data)
    
    def list(self, request):
        """
        GET /finance/projects/
        
        Список всех проектов с их бюджетными сводками.
        """
        user = request.user
        
        # Получаем воркспейсы пользователя; суперпользователь и staff видят все проекты
        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        )
        if not workspace_ids and (getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False)):
            workspace_ids = list(Project.objects.values_list('workspace_id', flat=True).distinct())
        
        projects = Project.objects.filter(
            workspace_id__in=workspace_ids
        ).order_by('-created_at')
        
        summaries = [
            ProjectBudgetSummarySerializer.from_project(project)
            for project in projects
        ]
        
        return Response(summaries)
    
    def retrieve(self, request, pk=None):
        """
        GET /finance/projects/{id}/
        
        Сводка бюджета конкретного проекта (алиас для summary).
        """
        return self.summary(request, pk=pk)


class FinanceAnalyticsViewSet(viewsets.ViewSet):
    """
    ViewSet для финансовой аналитики (дашборд).
    
    GET /api/v1/finance/analytics/summary/ — сводка: cash_flow_history,
    expenses_by_project, total_balance, has_cash_gap, current_month_expense.
    """

    permission_classes = [IsAuthenticated, IsDirectorOrManager]

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """
        GET /api/v1/finance/analytics/summary/
        
        Агрегаты по транзакциям проектов, доступных пользователю.
        Требуется фича finance_analytics в тарифе (SaaS Sprint 2).
        """
        if not SubscriptionService.has_feature(request.user, 'finance_analytics'):
            return Response(
                {
                    'code': 'FEATURE_LOCKED',
                    'detail': 'Аналитика по финансам недоступна на вашем тарифе.',
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        data = FinanceStatsService.get_analytics_summary(request.user)
        return Response(data)
