"""
Celery tasks for billing app.
"""
import logging
from datetime import datetime

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import BillingAccount, PaymentWebhookEvent, BillingSubscription
from .services import UsageService, PaymentProviderService
from apps.notifications.models import Notification
from apps.notifications.tasks import send_email_message, send_telegram_message
from apps.core.models import UserEvent

logger = logging.getLogger(__name__)


@shared_task(
    name='apps.billing.tasks.refresh_usage_summaries',
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
)
def refresh_usage_summaries():
    """
    Периодический refresh usage summary cache по активным billing-аккаунтам.
    """
    processed = 0
    skipped = 0
    for account in BillingAccount.objects.select_related('owner').filter(status=BillingAccount.STATUS_ACTIVE):
        owner = account.owner
        if not owner or not getattr(owner, 'is_active', False):
            skipped += 1
            continue
        UsageService.refresh_usage_cache_for_user(owner)
        processed += 1

    logger.info(
        'refresh_usage_summaries: processed=%s skipped=%s',
        processed,
        skipped,
    )
    return {'processed': processed, 'skipped': skipped}


@shared_task(
    name='apps.billing.tasks.process_payment_webhook_event',
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=5,
)
def process_payment_webhook_event(webhook_event_id: int):
    event = PaymentWebhookEvent.objects.filter(pk=webhook_event_id).first()
    if not event:
        return {'ok': False, 'reason': 'webhook_event_not_found'}
    return PaymentProviderService.process_webhook_event(event)


@shared_task(
    name='apps.billing.tasks.enforce_subscription_access_states',
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
)
def enforce_subscription_access_states():
    """
    R2-S3: автопереключение статусов доступа после истечения grace-периода.
    """
    grace_hours = int(getattr(settings, 'BILLING_GRACE_PERIOD_HOURS', 72))
    now = timezone.now()
    threshold = now - timezone.timedelta(hours=grace_hours)

    checked = 0
    suspended = 0

    qs = BillingSubscription.objects.select_related('account').filter(status=BillingSubscription.STATUS_PAST_DUE)
    for sub in qs:
        checked += 1
        meta = sub.meta or {}
        raw_since = meta.get('past_due_since')
        if not raw_since:
            continue
        try:
            since = datetime.fromisoformat(str(raw_since))
            if timezone.is_naive(since):
                since = timezone.make_aware(since, timezone.get_current_timezone())
        except Exception:
            continue
        if since <= threshold:
            sub.status = BillingSubscription.STATUS_SUSPENDED
            sub.save(update_fields=['status', 'updated_at'])
            if sub.account and sub.account.status != sub.account.STATUS_SUSPENDED:
                sub.account.status = sub.account.STATUS_SUSPENDED
                sub.account.save(update_fields=['status', 'updated_at'])
            suspended += 1

    logger.info(
        'enforce_subscription_access_states: checked=%s suspended=%s grace_hours=%s',
        checked,
        suspended,
        grace_hours,
    )
    return {'checked': checked, 'suspended': suspended, 'grace_hours': grace_hours}


@shared_task(
    name='apps.billing.tasks.process_dunning_notifications',
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
)
def process_dunning_notifications():
    """
    R2-S4: оркестрация dunning-уведомлений для past_due подписок.
    """
    schedule_hours = list(getattr(settings, 'BILLING_DUNNING_SCHEDULE_HOURS', [1, 24, 48]))
    now = timezone.now()
    checked = 0
    notified = 0
    skipped = 0

    qs = BillingSubscription.objects.select_related('account', 'account__owner').filter(
        status=BillingSubscription.STATUS_PAST_DUE
    )
    for sub in qs:
        checked += 1
        owner = sub.account.owner if sub.account else None
        if not owner:
            skipped += 1
            continue
        meta = dict(sub.meta or {})
        raw_since = meta.get('past_due_since')
        if not raw_since:
            skipped += 1
            continue
        try:
            since = datetime.fromisoformat(str(raw_since))
            if timezone.is_naive(since):
                since = timezone.make_aware(since, timezone.get_current_timezone())
        except Exception:
            skipped += 1
            continue

        attempts = int(meta.get('dunning_attempts', 0) or 0)
        if attempts >= len(schedule_hours):
            skipped += 1
            continue

        trigger_after_hours = int(schedule_hours[attempts])
        due_at = since + timezone.timedelta(hours=trigger_after_hours)
        if now < due_at:
            skipped += 1
            continue

        amount = None
        plan_name = None
        if sub.plan_version:
            amount = str(sub.plan_version.price)
            plan_name = sub.plan_version.name
        message = (
            f"Не удалось списать оплату за подписку{f' {plan_name}' if plan_name else ''}. "
            f"Попытка #{attempts + 1}. Обновите способ оплаты, чтобы избежать ограничения доступа."
        )
        Notification.objects.create(
            user=owner,
            type=Notification.TYPE_BUDGET_ALERT,
            message=message,
        )
        if owner.email:
            send_email_message.delay(
                owner.email,
                'Неуспешная оплата подписки',
                message,
            )
        if getattr(owner, 'telegram_id', None):
            send_telegram_message.delay(
                owner.id,
                message,
            )
        UserEvent.objects.create(
            user=owner,
            event_type=UserEvent.EVENT_PAYMENT,
            amount=None,
            details={
                'source': 'dunning',
                'status': 'past_due',
                'attempt': attempts + 1,
                'subscription_id': sub.id,
                'amount': amount,
            },
        )
        meta['dunning_attempts'] = attempts + 1
        meta['last_dunning_notified_at'] = now.isoformat()
        sub.meta = meta
        sub.save(update_fields=['meta', 'updated_at'])
        notified += 1

    logger.info(
        'process_dunning_notifications: checked=%s notified=%s skipped=%s schedule=%s',
        checked,
        notified,
        skipped,
        schedule_hours,
    )
    return {
        'checked': checked,
        'notified': notified,
        'skipped': skipped,
        'schedule': schedule_hours,
    }
