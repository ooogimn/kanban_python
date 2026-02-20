"""
Сигналы для finance app — Авто-Биллинг (Task 2.3 + 3.1).

Financial Snapshotting: стоимость фиксируется в момент сохранения (синхронно).
Создание транзакции SPEND выносится в фон (Celery) через on_commit.
"""
import logging
from decimal import Decimal

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender='timetracking.TimeLog')
def timelog_auto_billing(sender, instance, created, **kwargs):
    """
    Авто-биллинг при создании TimeLog.
    
    СИНХРОННО (мгновенно при сохранении):
    1. Определить ставку (hourly_rate) на момент работы
    2. Рассчитать стоимость (amount)
    3. Сохранить snapshot в TimeLog
    
    АСИНХРОННО (после commit, в Celery):
    4. Создать финансовую транзакцию SPEND — через process_timelog_billing.delay()
    
    on_commit обязателен: задача не должна уйти в Redis раньше, чем лог закоммичен в БД.
    """
    if not created:
        return
    if getattr(instance, '_skip_billing_signal', False):
        return
    if not instance.billable:
        logger.debug("TimeLog #%s is not billable, skipping", instance.id)
        return
    if not instance.duration_minutes or instance.duration_minutes <= 0:
        logger.debug("TimeLog #%s has no duration, skipping", instance.id)
        return

    try:
        rate = _get_hourly_rate(instance)
        if rate is None or rate <= 0:
            logger.warning("TimeLog #%s: hourly_rate is 0 or None, skipping", instance.id)
            return

        calculated_amount = (Decimal(instance.duration_minutes) / Decimal('60')) * rate

        # СИНХРОННО: snapshot в БД
        instance.hourly_rate = rate
        instance.amount = calculated_amount
        instance._skip_billing_signal = True
        instance.save(update_fields=['hourly_rate', 'amount'])

        logger.info(
            "TimeLog #%s: snapshot saved (rate=%s, amount=%s)",
            instance.id, rate, calculated_amount,
        )

        # АСИНХРОННО: биллинг в фоне после commit
        if calculated_amount > 0:
            from apps.finance.tasks import process_timelog_billing
            timelog_id = instance.id
            transaction.on_commit(lambda: process_timelog_billing.delay(timelog_id))
    except Exception as e:
        logger.exception("TimeLog #%s: auto-billing failed: %s", instance.id, e)


def _get_hourly_rate(timelog_instance):
    """
    Определение ставки для TimeLog.
    
    Приоритет:
    1. ProjectMember.hourly_rate (если существует модель и задана ставка)
    2. Project.hourly_rate
    3. 0 (если нигде не задано)
    
    Args:
        timelog_instance: экземпляр TimeLog
        
    Returns:
        Decimal или None
    """
    try:
        project = timelog_instance.workitem.project
        
        # Попытка получить ставку из ProjectMember (если модель существует)
        # TODO: Реализовать ProjectMember в будущем
        # try:
        #     from apps.todo.models import ProjectMember
        #     member = ProjectMember.objects.filter(
        #         project=project,
        #         user=timelog_instance.user
        #     ).first()
        #     if member and member.hourly_rate:
        #         return member.hourly_rate
        # except ImportError:
        #     pass
        
        # Ставка из проекта
        if project.hourly_rate:
            return project.hourly_rate
        
        # Если нигде не задано
        logger.warning(
            f"TimeLog #{timelog_instance.id}: no hourly_rate found "
            f"for project #{project.id}"
        )
        return Decimal('0')
    
    except Exception as e:
        logger.exception(
            f"Error getting hourly_rate for TimeLog #{timelog_instance.id}: {e}"
        )
        return Decimal('0')
