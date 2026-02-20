"""
Services for finance app — Ledger & Holds с защитой от Race Conditions (Task 2.2).

Double-Entry Logic + Immutability + select_for_update для атомарности.
"""
import logging
import uuid
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone

from .models import Category, Transaction, Wallet

logger = logging.getLogger(__name__)


class InsufficientFundsError(Exception):
    """Исключение при недостаточности средств."""
    pass


class TransactionService:
    """
    Сервис операций Ledger ↔ Wallet.
    Гарантирует атомарность и поддержку инвариантов баланса.
    """

    @staticmethod
    def _normalize_amount(amount) -> Decimal:
        value = Decimal(str(amount))
        if value <= 0:
            raise ValueError('Сумма должна быть положительной.')
        return value

    @staticmethod
    def _lock_wallet(wallet) -> Wallet:
        wallet_id = wallet.pk if isinstance(wallet, Wallet) else wallet
        return Wallet.objects.select_for_update().get(pk=wallet_id)

    @staticmethod
    def _detect_workspace(project=None, primary_wallet=None, secondary_wallet=None):
        if project and getattr(project, 'workspace', None):
            return project.workspace
        for w in (primary_wallet, secondary_wallet):
            if w and w.workspace:
                return w.workspace
        return None

    @staticmethod
    def _apply_wallet_delta(wallet: Wallet, delta: Decimal, allow_overdraft=False):
        if wallet is None:
            return
        new_balance = wallet.balance + delta
        if not allow_overdraft and new_balance < Decimal('0'):
            raise InsufficientFundsError(
                f'Недостаточно средств на кошельке "{wallet.name}". '
                f'Доступно: {wallet.balance}, требуется: {-delta}.'
            )
        wallet.balance = new_balance
        wallet.save(update_fields=['balance', 'updated_at'])

    @staticmethod
    @transaction.atomic
    def create_deposit(*, wallet, amount, created_by, description='', category=None,
                       project=None, workitem=None, status=Transaction.STATUS_COMPLETED):
        locked_wallet = TransactionService._lock_wallet(wallet)
        amount = TransactionService._normalize_amount(amount)
        workspace = TransactionService._detect_workspace(project, locked_wallet)
        tx = Transaction.objects.create(
            type=Transaction.TYPE_DEPOSIT,
            status=status,
            amount=amount,
            currency=locked_wallet.currency,
            description=description,
            project=project,
            related_workitem=workitem,
            workspace=workspace,
            destination_wallet=locked_wallet,
            category=category,
            created_by=created_by,
        )
        TransactionService._apply_wallet_delta(locked_wallet, amount, allow_overdraft=True)
        return tx

    @staticmethod
    @transaction.atomic
    def create_spend(*, amount, created_by, wallet=None, category=None, project=None,
                     workitem=None, description='', status=Transaction.STATUS_COMPLETED,
                     allow_overdraft=False, currency=None):
        locked_wallet = TransactionService._lock_wallet(wallet) if wallet else None
        amount = TransactionService._normalize_amount(amount)
        tx_currency = currency or (locked_wallet.currency if locked_wallet else 'RUB')
        if locked_wallet and currency and currency != locked_wallet.currency:
            raise ValueError('Currency mismatch between wallet и переданным значением.')
        workspace = TransactionService._detect_workspace(project, locked_wallet)
        tx = Transaction.objects.create(
            type=Transaction.TYPE_SPEND,
            status=status,
            amount=amount,
            currency=tx_currency,
            description=description,
            project=project,
            related_workitem=workitem,
            workspace=workspace,
            source_wallet=locked_wallet,
            category=category,
            created_by=created_by,
        )
        TransactionService._apply_wallet_delta(locked_wallet, -amount, allow_overdraft=allow_overdraft)
        return tx

    @staticmethod
    @transaction.atomic
    def create_transfer(*, from_wallet, to_wallet, amount, created_by,
                        description='', category=None, destination_category=None,
                        project=None, workitem=None, target_amount=None,
                        allow_overdraft=False):
        if from_wallet == to_wallet:
            raise ValueError('Нельзя выполнить перевод в тот же кошелек.')
        source = TransactionService._lock_wallet(from_wallet)
        destination = TransactionService._lock_wallet(to_wallet)
        amount = TransactionService._normalize_amount(amount)
        if source.currency == destination.currency:
            inbound_amount = amount
        else:
            if target_amount is None:
                raise ValueError('Для мультивалютного перевода требуется target_amount.')
            inbound_amount = TransactionService._normalize_amount(target_amount)

        group_id = uuid.uuid4()
        workspace = TransactionService._detect_workspace(project, source, destination)

        out_tx = Transaction.objects.create(
            type=Transaction.TYPE_TRANSFER,
            status=Transaction.STATUS_COMPLETED,
            amount=amount,
            currency=source.currency,
            description=description or f"Transfer to {destination.name}",
            project=project,
            related_workitem=workitem,
            workspace=workspace,
            source_wallet=source,
            destination_wallet=None,
            category=category,
            created_by=created_by,
            transfer_group_id=group_id,
        )

        in_tx = Transaction.objects.create(
            type=Transaction.TYPE_TRANSFER,
            status=Transaction.STATUS_COMPLETED,
            amount=inbound_amount,
            currency=destination.currency,
            description=description or f"Transfer from {source.name}",
            project=project,
            related_workitem=workitem,
            workspace=workspace,
            source_wallet=None,
            destination_wallet=destination,
            category=destination_category or category,
            created_by=created_by,
            transfer_group_id=group_id,
        )

        TransactionService._apply_wallet_delta(source, -amount, allow_overdraft=allow_overdraft)
        TransactionService._apply_wallet_delta(destination, inbound_amount, allow_overdraft=True)
        return out_tx, in_tx

    @staticmethod
    def create_payroll(*, company_wallet, user_wallet, amount, created_by,
                       description='Payroll payout', category=None, project=None,
                       target_amount=None):
        if category is None and company_wallet.workspace:
            category = Category.objects.filter(
                workspace=company_wallet.workspace,
                pnl_group=Category.PNL_SALARY
            ).first()
        return TransactionService.create_transfer(
            from_wallet=company_wallet,
            to_wallet=user_wallet,
            amount=amount,
            created_by=created_by,
            description=description,
            category=category,
            project=project,
            target_amount=target_amount,
        )

    @staticmethod
    @transaction.atomic
    def recalculate_wallet_balance(wallet_id):
        wallet = Wallet.objects.select_for_update().get(pk=wallet_id)
        completed = Transaction.objects.filter(
            status=Transaction.STATUS_COMPLETED,
        ).filter(
            Q(source_wallet=wallet) | Q(destination_wallet=wallet)
        )
        outgoing = completed.filter(source_wallet=wallet).aggregate(
            total=Coalesce(Sum('amount'), Decimal('0'))
        )['total']
        incoming = completed.filter(destination_wallet=wallet).aggregate(
            total=Coalesce(Sum('amount'), Decimal('0'))
        )['total']
        wallet.balance = incoming - outgoing
        wallet.save(update_fields=['balance', 'updated_at'])
        return wallet.balance


class FinanceService:
    """Сервис управления финансами проекта (Ledger & Holds)."""
    
    @staticmethod
    def get_project_balance(project_id):
        """
        Получение баланса проекта с агрегацией по типам транзакций.
        
        Формула:
        available = deposited - spent - (held - released)
        
        Args:
            project_id: ID проекта
            
        Returns:
            dict: {
                'total_budget': Decimal,  # deposited
                'spent': Decimal,
                'on_hold': Decimal,       # held - released
                'available': Decimal      # доступно для использования
            }
        """
        transactions = Transaction.objects.filter(
            project_id=project_id,
            status=Transaction.STATUS_COMPLETED,
        )
        
        aggregated = transactions.aggregate(
            deposited=Coalesce(
                Sum('amount', filter=Q(type=Transaction.TYPE_DEPOSIT)),
                Decimal('0')
            ),
            spent=Coalesce(
                Sum('amount', filter=Q(type=Transaction.TYPE_SPEND)),
                Decimal('0')
            ),
            held=Coalesce(
                Sum('amount', filter=Q(type=Transaction.TYPE_HOLD)),
                Decimal('0')
            ),
            released=Coalesce(
                Sum('amount', filter=Q(type=Transaction.TYPE_RELEASE)),
                Decimal('0')
            )
        )
        
        deposited = aggregated['deposited']
        spent = aggregated['spent']
        held = aggregated['held']
        released = aggregated['released']
        
        on_hold = held - released
        available = deposited - spent - on_hold
        
        return {
            'total_budget': deposited,
            'spent': spent,
            'on_hold': on_hold,
            'available': available,
        }
    
    @staticmethod
    @transaction.atomic
    def create_hold(project, amount, workitem, user, description=''):
        """
        Создание HOLD (заморозка средств под задачу).
        
        CRITICAL: Использует select_for_update для защиты от race conditions.
        
        Args:
            project: экземпляр Project
            amount: Decimal, сумма для заморозки
            workitem: экземпляр WorkItem
            user: пользователь
            description: описание
            
        Returns:
            Transaction: созданная транзакция HOLD
            
        Raises:
            InsufficientFundsError: если недостаточно средств
        """
        from apps.todo.models import Project
        
        # CRITICAL: Блокировка проекта для предотвращения гонки
        locked_project = Project.objects.select_for_update().get(pk=project.id)
        
        # Проверка баланса внутри транзакции
        balance = FinanceService.get_project_balance(locked_project.id)
        
        if balance['available'] < amount:
            raise InsufficientFundsError(
                f"Недостаточно средств. Доступно: {balance['available']}, "
                f"запрошено: {amount}"
            )
        
        # Создание транзакции HOLD
        hold_transaction = Transaction.objects.create(
            project=locked_project,
            workspace=locked_project.workspace,
            type=Transaction.TYPE_HOLD,
            amount=amount,
            related_workitem=workitem,
            created_by=user,
            description=description or f"Hold для задачи: {workitem.title}"
        )
        
        logger.info(
            f"Created HOLD #{hold_transaction.id}: {amount} "
            f"for workitem #{workitem.id} in project #{locked_project.id}"
        )
        
        return hold_transaction
    
    @staticmethod
    @transaction.atomic
    def commit_hold(
        workitem,
        actual_amount,
        user,
        description='',
        allow_overdraft=False,
        related_timelog=None,
    ):
        """
        Commit HOLD: превращение замороженных средств в потраченные.
        
        Логика "Elastic Hold" (Task 2.3):
        1. Находим все активные HOLD по workitem
        2. Создаём RELEASE на сумму всех HOLD (возвращаем в котёл)
        3. Создаём SPEND на actual_amount (списываем по факту)
        
        ВАЖНО: При allow_overdraft=True разрешён уход баланса в минус.
        Это используется для авто-биллинга (TimeLog -> Transaction).
        
        related_timelog: для идемпотентности биллинга (Task 3.1).
        
        CRITICAL: Использует select_for_update для защиты от race conditions.
        
        Args:
            workitem: экземпляр WorkItem
            actual_amount: Decimal, фактическая сумма расхода
            user: пользователь
            description: описание
            allow_overdraft: bool, разрешить овердрафт (default=False)
            related_timelog: TimeLog или None (для SPEND при авто-биллинге)
            
        Returns:
            tuple: (release_transaction, spend_transaction) или (spend_transaction,)
        """
        from apps.todo.models import Project
        
        # CRITICAL: Блокировка проекта
        locked_project = Project.objects.select_for_update().get(
            pk=workitem.project_id
        )
        
        # Находим все HOLD по этой задаче
        holds = Transaction.objects.filter(
            related_workitem=workitem,
            type=Transaction.TYPE_HOLD
        )
        
        # Считаем сумму HOLD
        hold_amount = holds.aggregate(
            total=Coalesce(Sum('amount'), Decimal('0'))
        )['total']
        
        if hold_amount == 0:
            logger.warning(
                f"No HOLD found for workitem #{workitem.id}, "
                f"creating SPEND directly"
            )
        
        transactions_created = []
        
        # 1. RELEASE: возвращаем замороженные средства
        if hold_amount > 0:
            release_transaction = Transaction.objects.create(
                project=locked_project,
                workspace=locked_project.workspace,
                type=Transaction.TYPE_RELEASE,
                amount=hold_amount,
                related_workitem=workitem,
                created_by=user,
                description=description or f"Release HOLD для задачи: {workitem.title}"
            )
            transactions_created.append(release_transaction)
            logger.info(
                f"Created RELEASE #{release_transaction.id}: {hold_amount} "
                f"for workitem #{workitem.id}"
            )
        
        # 2. SPEND: списываем фактическую сумму
        # Проверка баланса (если не разрешён овердрафт)
        if not allow_overdraft:
            balance = FinanceService.get_project_balance(locked_project.id)
            # После RELEASE баланс обновился, проверяем available
            if balance['available'] < actual_amount:
                raise InsufficientFundsError(
                    f"Недостаточно средств для SPEND. "
                    f"Доступно: {balance['available']}, запрошено: {actual_amount}"
                )
        
        spend_transaction = Transaction.objects.create(
            project=locked_project,
            workspace=locked_project.workspace,
            type=Transaction.TYPE_SPEND,
            amount=actual_amount,
            related_workitem=workitem,
            related_timelog=related_timelog,
            created_by=user,
            description=description or f"Расход по задаче: {workitem.title}"
        )
        transactions_created.append(spend_transaction)
        logger.info(
            f"Created SPEND #{spend_transaction.id}: {actual_amount} "
            f"for workitem #{workitem.id} (overdraft={allow_overdraft})"
        )
        
        return tuple(transactions_created)


class FinanceStatsService:
    """
    Сервис агрегированной финансовой аналитики для дашборда.
    Scope: только проекты, доступные пользователю (через WorkspaceMember).
    """

    @staticmethod
    def _get_user_project_ids(user):
        """ID проектов воркспейсов, в которых состоит пользователь."""
        from apps.todo.models import Project
        from apps.core.models import WorkspaceMember

        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list(
                'workspace_id', flat=True
            )
        )
        if not workspace_ids:
            return []
        # Суперпользователь и staff видят все проекты
        if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
            return list(Project.objects.values_list('id', flat=True))
        return list(
            Project.objects.filter(
                workspace_id__in=workspace_ids
            ).values_list('id', flat=True)
        )

    @classmethod
    def get_analytics_summary(cls, user):
        """
        Сводка для Finance Dashboard: cash_flow_history, expenses_by_project,
        total_balance, has_cash_gap, current_month_expense.

        Returns:
            dict: cash_flow_history, expenses_by_project, total_balance,
                  has_cash_gap, current_month_expense (опционально)
        """
        from .models import Transaction

        project_ids = cls._get_user_project_ids(user)
        if not project_ids:
            return {
                'cash_flow_history': [],
                'expenses_by_project': [],
                'total_balance': '0.00',
                'has_cash_gap': False,
                'current_month_expense': '0.00',
            }

        now = timezone.now()
        six_months_ago = now - timedelta(days=180)

        qs = Transaction.objects.filter(
            project_id__in=project_ids,
            created_at__gte=six_months_ago,
            created_at__lte=now,
            status=Transaction.STATUS_COMPLETED,
        )

        # cash_flow_history: последние 6 календарных месяцев, income=deposit, expense=spend
        by_month = (
            qs.annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(
                income=Coalesce(
                    Sum('amount', filter=Q(type=Transaction.TYPE_DEPOSIT)),
                    Decimal('0'),
                ),
                expense=Coalesce(
                    Sum('amount', filter=Q(type=Transaction.TYPE_SPEND)),
                    Decimal('0'),
                ),
            )
            .order_by('month')
        )
        by_month_map = {}
        for row in by_month:
            m = row['month']
            if m:
                key = m.strftime('%Y-%m')
                by_month_map[key] = {
                    'month': key,
                    'income': str(row['income']),
                    'expense': str(row['expense']),
                }

        # Последние 6 календарных месяцев (старые сначала)
        y, m = now.year, now.month
        month_keys = []
        for _ in range(6):
            month_keys.append(f'{y}-{m:02d}')
            m -= 1
            if m == 0:
                m, y = 12, y - 1
        month_keys.reverse()
        cash_flow_history = [
            by_month_map.get(
                mk,
                {'month': mk, 'income': '0.00', 'expense': '0.00'},
            )
            for mk in month_keys
        ]

        # expenses_by_project: сумма SPEND по project__name
        expenses_by_project = (
            Transaction.objects.filter(
                project_id__in=project_ids,
                type=Transaction.TYPE_SPEND,
                status=Transaction.STATUS_COMPLETED,
            )
            .values('project__name', 'project_id')
            .annotate(amount=Coalesce(Sum('amount'), Decimal('0')))
            .order_by('-amount')
        )
        expenses_by_project = [
            {
                'project_id': r['project_id'],
                'project_name': r['project__name'] or '—',
                'amount': str(r['amount']),
            }
            for r in expenses_by_project
        ]

        # total_balance: сумма available по всем проектам пользователя
        total_available = Decimal('0')
        for pid in project_ids:
            bal = FinanceService.get_project_balance(pid)
            total_available += bal['available']

        # has_cash_gap: расходы за последние 3 месяца > доходов И баланс < 0
        three_months_ago = now - timedelta(days=90)
        three_qs = Transaction.objects.filter(
            project_id__in=project_ids,
            created_at__gte=three_months_ago,
            created_at__lte=now,
            status=Transaction.STATUS_COMPLETED,
        )
        three_agg = three_qs.aggregate(
            income=Coalesce(
                Sum('amount', filter=Q(type=Transaction.TYPE_DEPOSIT)),
                Decimal('0'),
            ),
            expense=Coalesce(
                Sum('amount', filter=Q(type=Transaction.TYPE_SPEND)),
                Decimal('0'),
            ),
        )
        has_cash_gap = (
            three_agg['expense'] > three_agg['income']
            and total_available < 0
        )

        # Расход за текущий месяц
        current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        current_month_expense = (
            Transaction.objects.filter(
                project_id__in=project_ids,
                type=Transaction.TYPE_SPEND,
                status=Transaction.STATUS_COMPLETED,
                created_at__gte=current_month_start,
                created_at__lte=now,
            ).aggregate(total=Coalesce(Sum('amount'), Decimal('0')))['total']
            or Decimal('0')
        )

        return {
            'cash_flow_history': cash_flow_history,
            'expenses_by_project': expenses_by_project,
            'total_balance': str(total_available),
            'has_cash_gap': has_cash_gap,
            'current_month_expense': str(current_month_expense),
        }


# === Старая логика для совместимости (можно удалить после миграции) ===


def recalc_project_budget(project):
    """
    Пересчёт budget_spent для проекта.

    Формула:
    budget_spent = SUM(WorkItem.cost) + SUM(Transaction.amount WHERE type IN (expense, hold) AND status=completed)
    """
    if hasattr(project, '_skip_budget_signal') and project._skip_budget_signal:
        return

    from apps.todo.models import WorkItem
    from .models import Transaction

    workitems_total = WorkItem.objects.filter(
        project=project,
        deleted_at__isnull=True,
        cost__isnull=False
    ).aggregate(total=Sum('cost'))['total'] or Decimal('0')

    transactions_total = Transaction.objects.filter(
        project=project,
        type__in=[Transaction.TYPE_SPEND, Transaction.TYPE_HOLD],
        status=Transaction.STATUS_COMPLETED,
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

    new_spent = workitems_total + transactions_total

    if project.budget_spent != new_spent:
        project.budget_spent = new_spent
        project._skip_signal = True
        project.save(update_fields=['budget_spent'])

    _check_budget_alert(project)


def _check_budget_alert(project):
    """
    Проверка превышения порога бюджета.
    При превышении: создаём Notification для админов или выводим WARNING в консоль.
    """
    budget_total = project.budget_total or project.budget
    if not budget_total or budget_total == 0:
        return

    try:
        spent_percent = float(project.budget_spent / budget_total * 100)
    except (TypeError, ZeroDivisionError):
        return

    threshold = getattr(project, 'budget_alert_threshold', 80) or 80

    if spent_percent < threshold:
        return

    try:
        from apps.core.models import WorkspaceMember
        from apps.notifications.models import Notification

        notif_type = Notification.TYPE_BUDGET_ALERT

        admins = WorkspaceMember.objects.filter(
            workspace=project.workspace,
            role__in=[WorkspaceMember.ROLE_OWNER, WorkspaceMember.ROLE_ADMIN]
        ).select_related('user')

        message = f"⚠️ Бюджет проекта '{project.name}' израсходован на {spent_percent:.0f}%"

        for membership in admins:
            Notification.objects.create(
                type=notif_type,
                message=message,
                user=membership.user,
            )
    except Exception as e:
        logger.warning('Budget alert notification failed: %s', e)

    logger.warning(
        "WARNING: Budget Exceeded - Project '%s' (id=%s): spent %.1f%% (threshold %s%%)",
        project.name, project.id, spent_percent, threshold
    )
