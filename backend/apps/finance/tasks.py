"""
Celery-задачи для finance app — асинхронный биллинг (Task 3.1).

Идемпотентность: повторный запуск для того же TimeLog не создаёт дублирующую транзакцию.
Snapshot: сумма берётся из уже сохранённых в TimeLog полей amount/hourly_rate.
"""
import logging
from decimal import Decimal

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    name='apps.finance.tasks.process_timelog_billing',
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
)
def process_timelog_billing(timelog_id: int):
    """
    Асинхронная обработка биллинга по TimeLog.
    
    1. Получить TimeLog по ID.
    2. Проверка дублей: если уже есть SPEND для этого related_timelog — выйти (успех).
    3. Использовать Snapshot: amount из TimeLog (не пересчитывать).
    4. Вызвать FinanceService.commit_hold(..., allow_overdraft=True, related_timelog=...).
    
    Args:
        timelog_id: ID созданного TimeLog (int).
    """
    from apps.timetracking.models import TimeLog
    from apps.finance.models import Transaction
    from apps.finance.services import FinanceService

    timelog = TimeLog.objects.select_related('workitem__project').filter(
        pk=timelog_id
    ).first()
    if not timelog:
        logger.warning('process_timelog_billing: TimeLog id=%s not found', timelog_id)
        return {'ok': False, 'reason': 'timelog_not_found'}

    # Идемпотентность: уже есть SPEND по этому TimeLog — не списываем дважды
    if Transaction.objects.filter(
        related_timelog_id=timelog_id,
        type=Transaction.TYPE_SPEND,
    ).exists():
        logger.info(
            'process_timelog_billing: TimeLog id=%s already billed (idempotent skip)',
            timelog_id,
        )
        return {'ok': True, 'reason': 'already_billed'}

    # Snapshot: используем уже сохранённые в БД поля (не пересчитываем от проекта)
    amount = timelog.amount
    if amount is None or amount <= 0:
        logger.info(
            'process_timelog_billing: TimeLog id=%s has no amount (skip)',
            timelog_id,
        )
        return {'ok': True, 'reason': 'no_amount'}

    if not timelog.billable:
        logger.info(
            'process_timelog_billing: TimeLog id=%s not billable (skip)',
            timelog_id,
        )
        return {'ok': True, 'reason': 'not_billable'}

    description = (
        f"Авто-биллинг TimeLog #{timelog_id}: "
        f"{timelog.duration_minutes} мин × {timelog.hourly_rate or 0}/ч"
    )

    FinanceService.commit_hold(
        workitem=timelog.workitem,
        actual_amount=amount,
        user=timelog.user,
        description=description,
        allow_overdraft=True,
        related_timelog=timelog,
    )

    logger.info(
        'process_timelog_billing: TimeLog id=%s billed, amount=%s',
        timelog_id,
        amount,
    )
    return {'ok': True, 'timelog_id': timelog_id, 'amount': str(amount)}
