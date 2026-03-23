"""
Billing services — Invoice generation, PDF rendering, Subscription limits (SaaS Sprint 2).
"""
from decimal import Decimal, InvalidOperation
from datetime import date
from collections import defaultdict
import uuid
import jwt

from django.core.cache import cache
from django.core.files.base import ContentFile
from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone
from django.db.models import Q, Sum
from django.db import IntegrityError
from django.db import transaction
import requests

from .models import (
    Invoice,
    Subscription,
    BillingAccount,
    BillingSubscription,
    UsageMeter,
    UsageRecord,
    EntitlementOverride,
    PaymentTransaction,
    PaymentWebhookEvent,
)
from apps.timetracking.models import TimeLog
from apps.todo.models import Project
from apps.core.models import UserEvent


# Дефолтные лимиты Free (если у пользователя нет подписки или плана)
DEFAULT_FREE_LIMITS = {
    'max_system_contacts': 10,
    'max_ai_agents': 1,
    'features': {
        'hr': True,
        'payroll': False,
        'ai_analyst': False,
        'finance_analytics': False,
    },
}


class SubscriptionService:
    """
    Проверка лимитов и фич подписки пользователя (SaaS Sprint 2).
    """

    @staticmethod
    def get_user_limits(user):
        """
        Возвращает plan.limits текущей подписки пользователя или дефолтные Free лимиты.
        """
        if not user or not getattr(user, 'pk', None):
            return dict(DEFAULT_FREE_LIMITS)
        if getattr(user, 'is_superuser', False):
            # Суперпользователь — без ограничений (возвращаем лимиты с большими значениями)
            return {
                'max_system_contacts': 0,
                'max_ai_agents': 0,
                'features': {'hr': True, 'payroll': True, 'ai_analyst': True, 'finance_analytics': True},
            }
        try:
            sub = Subscription.objects.select_related('plan_obj').filter(user=user).first()
        except Exception:
            return dict(DEFAULT_FREE_LIMITS)
        if sub and sub.plan_obj and sub.plan_obj.limits:
            limits = dict(sub.plan_obj.limits)
            if 'features' not in limits or not isinstance(limits['features'], dict):
                limits['features'] = dict(DEFAULT_FREE_LIMITS.get('features', {}))
            return limits
        return dict(DEFAULT_FREE_LIMITS)

    @staticmethod
    def check_limit(user, metric_key, current_value=None):
        """
        Проверяет, не исчерпан ли лимит по метрике.
        metric_key: например 'max_system_contacts'.
        current_value: если не передано — считается текущее кол-во в БД.
        Возвращает True (можно) или False (лимит исчерпан).
        """
        limits = SubscriptionService.get_user_limits(user)
        limit = limits.get(metric_key)
        if limit is None:
            return True
        try:
            limit = int(limit)
        except (TypeError, ValueError):
            return True
        if limit < 0:
            return True  # отрицательное значение = без лимита
        if current_value is not None:
            return current_value < limit
        # Считаем текущее значение по метрике
        if metric_key == 'max_system_contacts':
            from apps.hr.models import Contact
            from apps.core.models import WorkspaceMember
            workspace_ids = list(
                WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
            )
            if not workspace_ids:
                return True
            current_value = Contact.objects.filter(
                super_group='SYSTEM',
                workspace_id__in=workspace_ids,
            ).count()
            return current_value < limit
        if metric_key == 'max_ai_agents':
            from apps.core.models import WorkspaceMember
            from apps.ai.models import WorkspaceAgent
            workspace_ids = list(
                WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
            )
            if not workspace_ids:
                return True
            current_value = WorkspaceAgent.objects.filter(workspace_id__in=workspace_ids).count()
            return current_value < limit
        return True

    @staticmethod
    def has_feature(user, feature_key):
        """
        Проверяет флаг в limits['features'] (например payroll, finance_analytics).
        """
        if getattr(user, 'is_superuser', False):
            return True
        limits = SubscriptionService.get_user_limits(user)
        features = limits.get('features')
        if not isinstance(features, dict):
            return False
        return bool(features.get(feature_key))


class BillingAccountService:
    """Сервис получения billing-аккаунта пользователя для ЛК."""

    @staticmethod
    def get_user_account(user):
        if not user or not getattr(user, 'pk', None):
            return None
        own = BillingAccount.objects.select_related('workspace', 'owner').filter(owner=user).first()
        if own:
            return own
        return (
            BillingAccount.objects.select_related('workspace', 'owner')
            .filter(workspace__memberships__user=user)
            .distinct()
            .first()
        )

    @staticmethod
    def get_current_subscription(account):
        if not account:
            return None
        preferred = [
            BillingSubscription.STATUS_ACTIVE,
            BillingSubscription.STATUS_TRIALING,
            BillingSubscription.STATUS_PAST_DUE,
            BillingSubscription.STATUS_MANUAL_HOLD,
            BillingSubscription.STATUS_SUSPENDED,
        ]
        for status_value in preferred:
            sub = (
                BillingSubscription.objects.select_related('plan_version')
                .prefetch_related('items')
                .filter(account=account, status=status_value)
                .order_by('-current_period_end', '-id')
                .first()
            )
            if sub:
                return sub
        return (
            BillingSubscription.objects.select_related('plan_version')
            .prefetch_related('items')
            .filter(account=account)
            .order_by('-current_period_end', '-id')
            .first()
        )


class EntitlementService:
    """Расчет effective entitlements для v2-контура подписок."""

    STATUS_ACCESS = {
        BillingSubscription.STATUS_ACTIVE: 'full',
        BillingSubscription.STATUS_TRIALING: 'full',
        BillingSubscription.STATUS_PAST_DUE: 'grace',
        BillingSubscription.STATUS_MANUAL_HOLD: 'read_only',
        BillingSubscription.STATUS_SUSPENDED: 'read_only',
        BillingSubscription.STATUS_CANCELED: 'read_only',
        BillingSubscription.STATUS_EXPIRED: 'read_only',
    }

    @staticmethod
    def _to_decimal(value):
        try:
            return Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            return Decimal('0')

    @staticmethod
    def _safe_int(value, default=0):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    @classmethod
    def _apply_addon_items(cls, limits, features, subscription):
        for item in subscription.items.filter(is_active=True):
            if item.item_type != item.ITEM_ADDON:
                continue
            meta = item.meta or {}
            limits_delta = meta.get('limits_delta', {})
            if isinstance(limits_delta, dict):
                for key, delta in limits_delta.items():
                    base = cls._safe_int(limits.get(key), 0)
                    limits[key] = base + cls._safe_int(delta, 0) * max(item.quantity, 1)
            features_delta = meta.get('features_delta', {})
            if isinstance(features_delta, dict):
                for key, val in features_delta.items():
                    features[key] = bool(val)

    @classmethod
    def _apply_overrides(cls, account, limits, features):
        now = timezone.now()
        overrides = EntitlementOverride.objects.filter(account=account, is_enabled=True).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=now)
        )
        for override in overrides:
            key = override.key or ''
            val = override.value
            if key.startswith('features.'):
                feature_key = key.split('.', 1)[1]
                features[feature_key] = bool(val if isinstance(val, bool) else (val or {}).get('enabled', True))
                continue
            if key.startswith('limits.'):
                limit_key = key.split('.', 1)[1]
                raw = val if isinstance(val, (int, float, str)) else (val or {}).get('value', 0)
                limits[limit_key] = cls._safe_int(raw, limits.get(limit_key, 0))
                continue
            # Фолбэк для нестандартных override-ключей.
            if isinstance(val, dict):
                limits[key] = val
            else:
                limits[key] = val

    @classmethod
    def calculate(cls, user, account=None, subscription=None):
        account = account or BillingAccountService.get_user_account(user)
        subscription = subscription or BillingAccountService.get_current_subscription(account) if account else None

        if not account or not subscription or not subscription.plan_version:
            legacy_limits = SubscriptionService.get_user_limits(user)
            features = legacy_limits.get('features', {}) if isinstance(legacy_limits, dict) else {}
            return {
                'source': 'legacy',
                'access_mode': 'full' if getattr(user, 'is_active', False) else 'read_only',
                'limits': legacy_limits,
                'features': features if isinstance(features, dict) else {},
                'restrictions': {'billing_read_only': False, 'reason': 'legacy_or_no_v2_subscription'},
            }

        limits = dict(subscription.plan_version.limits_schema or {})
        features = dict(subscription.plan_version.features_schema or {})
        if not isinstance(limits, dict):
            limits = {}
        if not isinstance(features, dict):
            features = {}

        cls._apply_addon_items(limits, features, subscription)
        cls._apply_overrides(account, limits, features)

        access_mode = cls.STATUS_ACCESS.get(subscription.status, 'read_only')
        restrictions = {
            'billing_read_only': access_mode == 'read_only',
            'allow_new_resources': access_mode in ('full', 'grace'),
            'reason': subscription.status,
        }
        if access_mode == 'grace':
            restrictions['allow_new_resources'] = False

        return {
            'source': 'v2',
            'access_mode': access_mode,
            'limits': limits,
            'features': features,
            'restrictions': restrictions,
            'subscription_status': subscription.status,
            'period': {
                'start': subscription.current_period_start.isoformat() if subscription.current_period_start else None,
                'end': subscription.current_period_end.isoformat() if subscription.current_period_end else None,
            },
        }


class UsageService:
    """Сервис агрегации потребления ресурсов за текущий billing period."""

    CACHE_TTL_SEC = 300

    @classmethod
    def _resolve_period(cls, subscription):
        now = timezone.now()
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        period_end = now
        if subscription:
            period_start = subscription.current_period_start
            period_end = subscription.current_period_end
        return period_start, period_end

    @classmethod
    def _cache_key(cls, account_id, period_start, period_end):
        return (
            f"billing:usage:summary:"
            f"account:{account_id}:"
            f"{period_start.isoformat()}:{period_end.isoformat()}"
        )

    @classmethod
    def invalidate_current_period_cache(cls, account, subscription=None):
        if not account:
            return
        subscription = subscription or BillingAccountService.get_current_subscription(account)
        period_start, period_end = cls._resolve_period(subscription)
        cache.delete(cls._cache_key(account.id, period_start, period_end))

    @classmethod
    def record_usage_event(
        cls,
        user,
        meter_code,
        quantity,
        source='',
        idempotency_key='',
        occurred_at=None,
        meta=None,
    ):
        account = BillingAccountService.get_user_account(user)
        if not account:
            raise ValueError('Billing account not found')
        meter = UsageMeter.objects.filter(code=meter_code, is_active=True).first()
        if not meter:
            raise ValueError('Usage meter not found')
        quantity_decimal = cls._safe_decimal(quantity)
        if quantity_decimal <= 0:
            raise ValueError('Quantity must be positive')
        occurred_at = occurred_at or timezone.now()
        meta = meta if isinstance(meta, dict) else {}

        created = True
        try:
            with transaction.atomic():
                record = UsageRecord.objects.create(
                    account=account,
                    meter=meter,
                    quantity=quantity_decimal,
                    occurred_at=occurred_at,
                    source=source or '',
                    idempotency_key=idempotency_key or '',
                    meta=meta,
                )
        except IntegrityError:
            if not idempotency_key:
                raise
            created = False
            record = UsageRecord.objects.get(
                account=account,
                meter=meter,
                idempotency_key=idempotency_key,
            )

        subscription = BillingAccountService.get_current_subscription(account)
        cls.invalidate_current_period_cache(account, subscription=subscription)
        return record, created

    @classmethod
    def refresh_usage_cache_for_user(cls, user):
        return cls.get_usage_summary(user, use_cache=True, force_refresh=True)

    @classmethod
    def get_usage_summary(cls, user, use_cache=True, force_refresh=False):
        account = BillingAccountService.get_user_account(user)
        subscription = BillingAccountService.get_current_subscription(account) if account else None
        entitlements = EntitlementService.calculate(user=user, account=account, subscription=subscription)
        period_start, period_end = cls._resolve_period(subscription)

        if not account:
            return {
                'period_start': period_start,
                'period_end': period_end,
                'meters': [],
                'totals': {'used': 0, 'overage': 0},
                'entitlements': entitlements,
            }

        cache_key = cls._cache_key(account.id, period_start, period_end)
        if use_cache and not force_refresh:
            cached = cache.get(cache_key)
            if cached:
                return cached

        rows = (
            UsageRecord.objects.filter(account=account, occurred_at__gte=period_start, occurred_at__lte=period_end)
            .values('meter__code')
            .annotate(used=Sum('quantity'))
            .order_by('meter__code')
        )
        limits = entitlements.get('limits', {}) if isinstance(entitlements.get('limits'), dict) else {}
        meters = []
        total_used = Decimal('0')
        total_overage = Decimal('0')
        for row in rows:
            code = row['meter__code']
            used = cls._safe_decimal(row.get('used'))
            total_used += used
            raw_limit = limits.get(code, limits.get(f'max_{code}'))
            included = cls._safe_decimal(raw_limit) if raw_limit is not None else None
            if included is not None and included < 0:
                included = None
            remaining = None if included is None else included - used
            overage = Decimal('0') if included is None else max(Decimal('0'), used - included)
            total_overage += overage
            meters.append(
                {
                    'code': code,
                    'used': str(used),
                    'included': str(included) if included is not None else None,
                    'remaining': str(remaining) if remaining is not None else None,
                    'overage': str(overage),
                }
            )
        summary = {
            'period_start': period_start,
            'period_end': period_end,
            'meters': meters,
            'totals': {'used': str(total_used), 'overage': str(total_overage)},
            'entitlements': entitlements,
        }
        if use_cache:
            cache.set(cache_key, summary, cls.CACHE_TTL_SEC)
        return summary

    @staticmethod
    def _safe_decimal(value):
        try:
            return Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            return Decimal('0')


class CutoverReadinessService:
    """Проверки готовности к переключению с legacy billing на v2."""

    @staticmethod
    def get_user_readiness(user):
        account = BillingAccountService.get_user_account(user)
        sub_v2 = BillingAccountService.get_current_subscription(account) if account else None
        sub_legacy = Subscription.objects.filter(user=user).first() if user and getattr(user, 'pk', None) else None

        checks = {
            'has_account_v2': bool(account),
            'has_subscription_v2': bool(sub_v2),
            'has_legacy_subscription': bool(sub_legacy),
            'workspace_linked': bool(account and account.workspace_id),
            'owner_linked': bool(account and account.owner_id),
            'period_valid': bool(
                sub_v2 and sub_v2.current_period_start and sub_v2.current_period_end
                and sub_v2.current_period_start <= sub_v2.current_period_end
            ),
            'plan_version_linked': bool(sub_v2 and sub_v2.plan_version_id),
        }
        problems = []
        if not checks['has_account_v2']:
            problems.append('missing_billing_account_v2')
        if not checks['has_subscription_v2']:
            problems.append('missing_subscription_v2')
        if checks['has_subscription_v2'] and not checks['plan_version_linked']:
            problems.append('missing_plan_version_link')
        if checks['has_subscription_v2'] and not checks['period_valid']:
            problems.append('invalid_subscription_period')
        if account and not checks['workspace_linked']:
            problems.append('account_not_linked_to_workspace')
        if account and not checks['owner_linked']:
            problems.append('account_not_linked_to_owner')

        ready = bool(checks['has_account_v2'] and checks['has_subscription_v2'] and checks['period_valid'] and checks['plan_version_linked'])
        return {
            'ready': ready,
            'mode': 'v2' if ready else ('legacy' if checks['has_legacy_subscription'] else 'none'),
            'checks': checks,
            'problems': problems,
            'account_id': account.id if account else None,
            'subscription_v2_id': sub_v2.id if sub_v2 else None,
            'legacy_subscription_id': sub_legacy.id if sub_legacy else None,
        }


class PaymentProviderService:
    """R2: интеграция платежного провайдера (первый провайдер — ЮKassa)."""

    YOOKASSA_API_URL = 'https://api.yookassa.ru/v3/payments'
    YANDEX_PAY_DEFAULT_SANDBOX_API_URL = 'https://sandbox.pay.yandex.ru'
    YANDEX_PAY_DEFAULT_PROD_API_URL = 'https://pay.yandex.ru'

    @staticmethod
    def _yookassa_creds():
        shop_id = getattr(settings, 'YOOKASSA_SHOP_ID', '')
        secret_key = getattr(settings, 'YOOKASSA_SECRET_KEY', '')
        if not shop_id or not secret_key:
            raise ValueError('YOOKASSA credentials are not configured')
        return shop_id, secret_key

    @staticmethod
    def _yandex_pay_creds():
        merchant_id = getattr(settings, 'YANDEX_PAY_MERCHANT_ID', '')
        api_key = getattr(settings, 'YANDEX_PAY_API_KEY', '')
        if not merchant_id or not api_key:
            raise ValueError('YANDEX_PAY credentials are not configured')
        return merchant_id, api_key

    @classmethod
    def _yandex_pay_api_base(cls):
        raw = getattr(settings, 'YANDEX_PAY_API_URL', '').strip()
        if raw:
            return raw.rstrip('/')
        test_mode = bool(getattr(settings, 'YANDEX_PAY_TEST_MODE', True))
        return (
            cls.YANDEX_PAY_DEFAULT_SANDBOX_API_URL
            if test_mode
            else cls.YANDEX_PAY_DEFAULT_PROD_API_URL
        )

    @classmethod
    def _yandex_pay_jwks_url(cls):
        api_base = cls._yandex_pay_api_base()
        return f'{api_base}/api/jwks'

    @classmethod
    def create_yookassa_payment_intent(
        cls,
        user,
        amount,
        currency='RUB',
        description='',
        return_url=None,
        idempotency_key='',
        meta=None,
    ):
        account = BillingAccountService.get_user_account(user)
        if not account:
            raise ValueError('Billing account not found')

        amount_dec = UsageService._safe_decimal(amount)
        if amount_dec <= 0:
            raise ValueError('Amount must be positive')

        subscription = BillingAccountService.get_current_subscription(account)
        return_url = return_url or getattr(settings, 'YOOKASSA_RETURN_URL', '')
        if not return_url:
            raise ValueError('YOOKASSA_RETURN_URL is not configured')

        shop_id, secret_key = cls._yookassa_creds()
        idempotency_key = idempotency_key or uuid.uuid4().hex
        meta = meta if isinstance(meta, dict) else {}

        payload = {
            'amount': {'value': f'{amount_dec:.2f}', 'currency': currency},
            'capture': True,
            'confirmation': {'type': 'redirect', 'return_url': return_url},
            'description': description or f'Subscription payment for account {account.id}',
            'metadata': {'account_id': str(account.id), **meta},
        }
        response = requests.post(
            cls.YOOKASSA_API_URL,
            json=payload,
            auth=(shop_id, secret_key),
            headers={'Idempotence-Key': idempotency_key},
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        provider_payment_id = str(data.get('id', '') or '')
        status = str(data.get('status', '') or PaymentTransaction.STATUS_PENDING)
        confirmation_url = ((data.get('confirmation') or {}).get('confirmation_url') or '') if isinstance(data, dict) else ''

        tx, _created = PaymentTransaction.objects.get_or_create(
            account=account,
            provider=PaymentTransaction.PROVIDER_YOOKASSA,
            idempotency_key=idempotency_key,
            defaults={
                'subscription': subscription,
                'provider_payment_id': provider_payment_id,
                'status': status,
                'amount': amount_dec,
                'currency': currency,
                'description': payload['description'],
                'confirmation_url': confirmation_url,
                'raw_response': data,
                'meta': meta,
            },
        )
        if tx.provider_payment_id != provider_payment_id or tx.status != status:
            tx.provider_payment_id = provider_payment_id
            tx.status = status
            tx.confirmation_url = confirmation_url
            tx.raw_response = data
            tx.save(update_fields=['provider_payment_id', 'status', 'confirmation_url', 'raw_response', 'updated_at'])
        return tx, data

    @classmethod
    def create_yandex_pay_payment(
        cls,
        user,
        amount,
        currency='RUB',
        description='',
        return_url=None,
        idempotency_key='',
        meta=None,
    ):
        account = BillingAccountService.get_user_account(user)
        if not account:
            raise ValueError('Billing account not found')

        amount_dec = UsageService._safe_decimal(amount)
        if amount_dec <= 0:
            raise ValueError('Amount must be positive')

        subscription = BillingAccountService.get_current_subscription(account)
        merchant_id, api_key = cls._yandex_pay_creds()
        idempotency_key = idempotency_key or uuid.uuid4().hex
        meta = meta if isinstance(meta, dict) else {}

        return_url = return_url or getattr(settings, 'YOOKASSA_RETURN_URL', '')
        if not return_url:
            raise ValueError('return_url is not configured')

        payload = {
            'orderId': idempotency_key,
            'currencyCode': currency,
            'cart': {
                'items': [
                    {
                        'product': {'title': description or f'Subscription payment for account {account.id}'},
                        'quantity': {'count': '1'},
                        'total': f'{amount_dec:.2f}',
                    }
                ],
                'total': {'amount': f'{amount_dec:.2f}'},
            },
            'redirectUrls': {
                'onSuccess': return_url,
                'onError': return_url,
            },
            'metadata': {'account_id': str(account.id), **meta},
        }
        request_id = uuid.uuid4().hex
        response = requests.post(
            f'{cls._yandex_pay_api_base()}/api/merchant/v1/orders',
            json=payload,
            headers={
                'Authorization': f'Api-Key {api_key}',
                'Merchant-Id': merchant_id,
                'Content-Type': 'application/json',
                'X-Request-Id': request_id,
                'X-Request-Timeout': '10000',
                'X-Request-Attempt': '0',
            },
            timeout=20,
        )
        response.raise_for_status()
        data = response.json() if response.content else {}
        response_data = data.get('data') if isinstance(data, dict) else {}
        if not isinstance(response_data, dict):
            response_data = {}
        confirmation_url = str(response_data.get('paymentUrl') or '')
        provider_payment_id = str(response_data.get('orderId') or idempotency_key)
        status = PaymentTransaction.STATUS_PENDING

        tx, _created = PaymentTransaction.objects.get_or_create(
            account=account,
            provider='yandex_pay',
            idempotency_key=idempotency_key,
            defaults={
                'subscription': subscription,
                'provider_payment_id': provider_payment_id,
                'status': status,
                'amount': amount_dec,
                'currency': currency,
                'description': description or f'Yandex Pay payment for account {account.id}',
                'confirmation_url': confirmation_url,
                'raw_response': data,
                'meta': meta,
            },
        )
        if tx.provider_payment_id != provider_payment_id or tx.status != status:
            tx.provider_payment_id = provider_payment_id
            tx.status = status
            tx.confirmation_url = confirmation_url
            tx.raw_response = data
            tx.save(update_fields=['provider_payment_id', 'status', 'confirmation_url', 'raw_response', 'updated_at'])
        return tx, data

    @classmethod
    def decode_yandex_pay_webhook_token(cls, token):
        token = (token or '').strip()
        if not token:
            raise ValueError('Empty JWT token')
        merchant_id, _api_key = cls._yandex_pay_creds()
        jwks_client = jwt.PyJWKClient(cls._yandex_pay_jwks_url())
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=['ES256'],
            options={'verify_exp': True},
        )
        if str(payload.get('merchantId') or '') != str(merchant_id):
            raise ValueError('merchantId mismatch')
        return payload

    @staticmethod
    def _should_apply_transaction_status(current_status, incoming_status):
        """
        Защита от out-of-order событий: не даем деградировать уже финализированные статусы.
        """
        if not incoming_status:
            return False
        if not current_status or current_status == incoming_status:
            return True

        # Успешный платеж не должен откатываться назад от запоздавших webhook.
        if current_status == PaymentTransaction.STATUS_SUCCEEDED and incoming_status != PaymentTransaction.STATUS_SUCCEEDED:
            return False

        # Из terminal failed/canceled/refunded не откатываемся в промежуточные состояния.
        if current_status in (
            PaymentTransaction.STATUS_CANCELED,
            PaymentTransaction.STATUS_FAILED,
            PaymentTransaction.STATUS_REFUNDED,
        ) and incoming_status in (
            PaymentTransaction.STATUS_PENDING,
            PaymentTransaction.STATUS_REQUIRES_ACTION,
            PaymentTransaction.STATUS_WAITING_CAPTURE,
        ):
            return False

        return True

    @staticmethod
    def ingest_webhook(provider, payload):
        payload = payload if isinstance(payload, dict) else {}
        event_type = str(payload.get('event') or '')
        provider_payment_id = ''
        if provider == 'yookassa':
            obj = payload.get('object') if isinstance(payload.get('object'), dict) else {}
            provider_payment_id = str(obj.get('id') or '')
            event_id = f"{event_type}:{provider_payment_id or uuid.uuid4().hex}"
        elif provider == 'yandex_pay':
            order = payload.get('order') if isinstance(payload.get('order'), dict) else {}
            provider_payment_id = str(order.get('orderId') or '')
            event_time = str(payload.get('eventTime') or '')
            event_id = f"{event_type}:{provider_payment_id}:{event_time or uuid.uuid4().hex}"
        else:
            event_id = f"{event_type}:{uuid.uuid4().hex}"

        event, created = PaymentWebhookEvent.objects.get_or_create(
            provider=provider,
            event_id=event_id,
            defaults={
                'event_type': event_type,
                'payload': payload,
                'status': PaymentWebhookEvent.STATUS_PENDING,
            },
        )
        if not created and event.status == PaymentWebhookEvent.STATUS_PROCESSED:
            return event, False
        if not created:
            event.payload = payload
            event.event_type = event_type
            event.status = PaymentWebhookEvent.STATUS_PENDING
            event.error_message = ''
            event.save(update_fields=['payload', 'event_type', 'status', 'error_message', 'updated_at'])
        return event, True

    @staticmethod
    def _mark_subscription_past_due(subscription, reason='payment_failed'):
        if not subscription:
            return
        now = timezone.now()
        meta = dict(subscription.meta or {})
        if 'past_due_since' not in meta:
            meta['past_due_since'] = now.isoformat()
        meta['past_due_reason'] = reason
        meta.setdefault('dunning_attempts', 0)
        subscription.meta = meta
        if subscription.status in (
            subscription.STATUS_ACTIVE,
            subscription.STATUS_TRIALING,
        ):
            subscription.status = subscription.STATUS_PAST_DUE
            subscription.save(update_fields=['status', 'meta', 'updated_at'])
        else:
            subscription.save(update_fields=['meta', 'updated_at'])
        account = subscription.account
        if account and account.status != account.STATUS_SUSPENDED:
            account.status = account.STATUS_ACTIVE
            account.save(update_fields=['status', 'updated_at'])

    @staticmethod
    def _mark_subscription_active(subscription):
        if not subscription:
            return
        meta = dict(subscription.meta or {})
        if 'past_due_since' in meta:
            meta.pop('past_due_since', None)
        if 'past_due_reason' in meta:
            meta.pop('past_due_reason', None)
        if 'dunning_attempts' in meta:
            meta.pop('dunning_attempts', None)
        if 'last_dunning_notified_at' in meta:
            meta.pop('last_dunning_notified_at', None)
        subscription.meta = meta
        if subscription.status in (
            subscription.STATUS_PAST_DUE,
            subscription.STATUS_SUSPENDED,
            subscription.STATUS_MANUAL_HOLD,
            subscription.STATUS_EXPIRED,
        ):
            subscription.status = subscription.STATUS_ACTIVE
            subscription.save(update_fields=['status', 'meta', 'updated_at'])
        else:
            subscription.save(update_fields=['meta', 'updated_at'])
        account = subscription.account
        if account and account.status != account.STATUS_ACTIVE:
            account.status = account.STATUS_ACTIVE
            account.save(update_fields=['status', 'updated_at'])

    @staticmethod
    def process_webhook_event(event):
        payload = event.payload if isinstance(event.payload, dict) else {}
        raw_status = ''
        if event.provider == 'yookassa':
            obj = payload.get('object') if isinstance(payload.get('object'), dict) else {}
            provider_payment_id = str(obj.get('id') or '')
            raw_status = str(obj.get('status') or '')
            raw_response = obj
            status_map = {
                'pending': PaymentTransaction.STATUS_PENDING,
                'waiting_for_capture': PaymentTransaction.STATUS_WAITING_CAPTURE,
                'succeeded': PaymentTransaction.STATUS_SUCCEEDED,
                'canceled': PaymentTransaction.STATUS_CANCELED,
                'failed': PaymentTransaction.STATUS_FAILED,
            }
            status = status_map.get(raw_status, raw_status)
        elif event.provider == 'yandex_pay':
            order = payload.get('order') if isinstance(payload.get('order'), dict) else {}
            provider_payment_id = str(order.get('orderId') or '')
            raw_status = str(order.get('paymentStatus') or '')
            raw_response = payload
            status_map = {
                'PENDING': PaymentTransaction.STATUS_PENDING,
                'AUTHORIZED': PaymentTransaction.STATUS_WAITING_CAPTURE,
                'CAPTURED': PaymentTransaction.STATUS_SUCCEEDED,
                'FAILED': PaymentTransaction.STATUS_FAILED,
                'CANCELLED': PaymentTransaction.STATUS_CANCELED,
            }
            status = status_map.get(raw_status, PaymentTransaction.STATUS_PENDING)
        else:
            provider_payment_id = ''
            raw_response = payload
            status = ''
        tx = PaymentTransaction.objects.filter(
            provider=event.provider,
            provider_payment_id=provider_payment_id,
        ).first()
        if not tx:
            event.status = PaymentWebhookEvent.STATUS_FAILED
            event.error_message = 'payment_transaction_not_found'
            event.processed_at = timezone.now()
            event.save(update_fields=['status', 'error_message', 'processed_at', 'updated_at'])
            return {'ok': False, 'reason': 'payment_transaction_not_found'}

        update_fields = ['updated_at']
        previous_status = tx.status
        apply_status = PaymentProviderService._should_apply_transaction_status(previous_status, status)
        if status and apply_status:
            tx.status = status
            update_fields.append('status')
        tx.raw_response = raw_response
        update_fields.append('raw_response')

        effective_status = tx.status if apply_status else previous_status
        became_succeeded = (
            apply_status
            and status == PaymentTransaction.STATUS_SUCCEEDED
            and previous_status != PaymentTransaction.STATUS_SUCCEEDED
        )
        became_failed_or_canceled = (
            apply_status
            and status in (PaymentTransaction.STATUS_CANCELED, PaymentTransaction.STATUS_FAILED)
            and previous_status not in (PaymentTransaction.STATUS_CANCELED, PaymentTransaction.STATUS_FAILED)
        )

        if became_succeeded:
            tx.paid_at = timezone.now()
            update_fields.append('paid_at')
            PaymentProviderService._mark_subscription_active(tx.subscription)
            if tx.account and tx.account.owner_id:
                UserEvent.objects.create(
                    user=tx.account.owner,
                    event_type=UserEvent.EVENT_PAYMENT,
                    amount=tx.amount,
                    details={
                        'source': tx.provider,
                        'status': 'paid',
                        'currency': tx.currency,
                        'transaction_id': tx.id,
                        'provider_payment_id': tx.provider_payment_id,
                    },
                )
            try:
                from apps.bot.services import send_admin_notification
                admin_msg = (
                    f"💰 <b>Новый платеж!</b>\n"
                    f"Сумма: {tx.amount} {tx.currency}\n"
                    f"Провайдер: {tx.provider}\n"
                    f"Аккаунт: {tx.account.owner.email if tx.account and tx.account.owner else 'N/A'}"
                )
                send_admin_notification(admin_msg)
            except Exception as e:
                logger.warning('Failed to send admin notification for payment tx=%s: %s', tx.id, e)
        if became_failed_or_canceled:
            tx.canceled_at = timezone.now()
            update_fields.append('canceled_at')
            PaymentProviderService._mark_subscription_past_due(tx.subscription, reason=status)
        tx.save(update_fields=update_fields)

        event.status = PaymentWebhookEvent.STATUS_PROCESSED
        event.error_message = ''
        event.processed_at = timezone.now()
        event.save(update_fields=['status', 'error_message', 'processed_at', 'updated_at'])
        return {'ok': True, 'transaction_id': tx.id, 'status': effective_status}


class InvoiceGenerator:
    """
    Генератор черновиков счетов на основе TimeLog.
    """

    @staticmethod
    def _next_invoice_number() -> str:
        """Генерация номера счёта: INV-YYYY-XXXX."""
        year = timezone.now().year
        last = Invoice.objects.filter(
            number__startswith=f'INV-{year}-'
        ).order_by('-number').values_list('number', flat=True).first()
        if last:
            try:
                seq = int(last.split('-')[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        return f'INV-{year}-{seq:04d}'

    @classmethod
    def generate_draft(
        cls,
        project_id: int,
        date_start: date,
        date_end: date,
        created_by,
    ) -> Invoice | None:
        """
        Создать черновик счёта за период.
        
        Находит billable TimeLog проекта, ещё не включённые ни в один счёт.
        Группирует по WorkItem, формирует line_items.
        """
        project = Project.objects.select_related('customer').get(pk=project_id)

        invoiced_timelog_ids = Invoice.objects.values_list(
            'related_timelogs', flat=True
        ).distinct()

        timelogs = TimeLog.objects.filter(
            workitem__project_id=project_id,
            billable=True,
            started_at__date__gte=date_start,
            started_at__date__lte=date_end,
            amount__isnull=False,
        ).exclude(
            id__in=invoiced_timelog_ids
        ).select_related('workitem', 'user')

        if not timelogs.exists():
            return None

        grouped: dict[int, list[TimeLog]] = defaultdict(list)
        for tl in timelogs:
            grouped[tl.workitem_id].append(tl)

        line_items = []
        amount_total = Decimal('0')

        for workitem_id, logs in grouped.items():
            workitem = logs[0].workitem
            hours = sum(Decimal(str(tl.duration_minutes or 0)) / 60 for tl in logs)
            rate = logs[0].hourly_rate or project.hourly_rate or Decimal('0')
            amount = sum(tl.amount or Decimal('0') for tl in logs)
            amount_total += amount
            line_items.append({
                'title': workitem.title,
                'hours': float(hours),
                'rate': str(rate),
                'amount': str(amount),
            })

        date_due = date_end
        if date_due <= date_start:
            from datetime import timedelta
            date_due = date_start + timedelta(days=14)

        invoice = Invoice.objects.create(
            project=project,
            customer=project.customer,
            number=cls._next_invoice_number(),
            status=Invoice.STATUS_DRAFT,
            date_issue=date_start,
            date_due=date_due,
            amount_total=amount_total,
            line_items=line_items,
            created_by=created_by,
        )
        invoice.related_timelogs.set(timelogs)
        return invoice


class PDFRenderer:
    """
    Рендеринг HTML-шаблона в PDF через WeasyPrint.
    """

    @staticmethod
    def render(invoice: Invoice) -> bytes:
        """
        Рендер счёта в PDF.
        
        Возвращает байты PDF.
        """
        from weasyprint import HTML
        from weasyprint.text.fonts import FontConfiguration

        font_config = FontConfiguration()
        context = {
            'invoice': invoice,
            'project': invoice.project,
            'customer': invoice.customer or invoice.project.customer,
            'line_items': invoice.line_items,
        }
        html_str = render_to_string('billing/invoice.html', context)
        html = HTML(string=html_str)
        pdf_bytes = html.write_pdf(font_config=font_config)
        return pdf_bytes

    @classmethod
    def render_and_save(cls, invoice: Invoice) -> bytes:
        """
        Рендер PDF и сохранение в модель.
        
        Возвращает байты PDF.
        """
        pdf_bytes = cls.render(invoice)
        filename = f"{invoice.number.replace('/', '-')}.pdf"
        invoice.pdf_file.save(
            filename,
            ContentFile(pdf_bytes),
            save=True,
        )
        return pdf_bytes
