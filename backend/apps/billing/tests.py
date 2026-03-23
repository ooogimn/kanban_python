from datetime import timedelta
from decimal import Decimal
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.billing.models import (
    BillingAccount,
    PlanVersion,
    BillingSubscription,
    SubscriptionItem,
    EntitlementOverride,
    UsageMeter,
    UsageRecord,
    Invoice,
    PaymentTransaction,
    PaymentWebhookEvent,
)
from apps.core.models import Workspace, WorkspaceMember, UserEvent
from apps.todo.models import Project
from apps.billing.services import PaymentProviderService
from apps.billing.tasks import enforce_subscription_access_states, process_dunning_notifications
from apps.notifications.models import Notification

User = get_user_model()


class BillingCabinetApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='billing_user', email='billing@example.com', password='pass12345')
        self.workspace = Workspace.objects.create(name='Billing WS', slug='billing-ws', owner=self.user)
        WorkspaceMember.objects.create(workspace=self.workspace, user=self.user, role=WorkspaceMember.ROLE_OWNER)
        self.account = BillingAccount.objects.create(workspace=self.workspace, owner=self.user, status=BillingAccount.STATUS_ACTIVE)
        self.plan = PlanVersion.objects.create(
            code='pro_monthly',
            name='Pro Monthly',
            version=1,
            interval=PlanVersion.INTERVAL_MONTH,
            price=Decimal('1200'),
            currency='RUB',
            limits_schema={'max_ai_agents': 2},
            features_schema={'payroll': False, 'ai_analyst': True},
        )
        self.subscription = BillingSubscription.objects.create(
            account=self.account,
            plan_version=self.plan,
            status=BillingSubscription.STATUS_ACTIVE,
            current_period_start=timezone.now() - timedelta(days=3),
            current_period_end=timezone.now() + timedelta(days=27),
            provider='yookassa',
            cancel_at_period_end=True,
        )
        self.project = Project.objects.create(
            name='Billing Project',
            workspace=self.workspace,
            owner=self.user,
        )
        self.invoice = Invoice.objects.create(
            project=self.project,
            customer=None,
            number='INV-TEST-0001',
            status=Invoice.STATUS_DRAFT,
            date_issue=timezone.now().date(),
            date_due=(timezone.now() + timedelta(days=10)).date(),
            amount_total=Decimal('2500.00'),
            line_items=[{'title': 'Subscription', 'hours': 0, 'rate': '0', 'amount': '2500'}],
            created_by=self.user,
        )
        UserEvent.objects.create(
            user=self.user,
            event_type=UserEvent.EVENT_PAYMENT,
            amount=Decimal('2500'),
            details={'source': 'test-gateway', 'status': 'paid', 'currency': 'RUB', 'note': 'Оплата подписки'},
        )
        SubscriptionItem.objects.create(
            subscription=self.subscription,
            item_type=SubscriptionItem.ITEM_ADDON,
            code='addon_ai_pack',
            quantity=2,
            unit_price=Decimal('500'),
            meta={'limits_delta': {'max_ai_agents': 1}, 'features_delta': {'payroll': True}},
        )
        EntitlementOverride.objects.create(
            account=self.account,
            key='limits.max_ai_agents',
            value={'value': 6},
            is_enabled=True,
            created_by=self.user,
        )
        self.client.force_authenticate(self.user)

    def test_billing_account_me_returns_effective_entitlements(self):
        response = self.client.get('/api/v1/billing/account/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body['account_id'], self.account.id)
        self.assertEqual(body['plan_code'], 'pro_monthly')
        self.assertEqual(body['plan_badge'], 'PRO')
        self.assertEqual(body['plan_interval'], 'month')
        self.assertEqual(body['plan_currency'], 'RUB')
        self.assertEqual(body['account_status'], BillingAccount.STATUS_ACTIVE)
        self.assertEqual(body['provider_display'], 'ЮKassa')
        self.assertTrue(body['status_flags']['will_cancel_at_period_end'])
        self.assertFalse(body['status_flags']['is_read_only'])
        self.assertEqual(body['status_flags']['dunning_attempts'], 0)
        self.assertEqual(body['status'], BillingSubscription.STATUS_ACTIVE)
        self.assertEqual(body['entitlement']['source'], 'subscription')
        self.assertEqual(body['entitlement']['access_mode'], 'full')
        self.assertIn('period', body['entitlement'])
        self.assertEqual(body['entitlements']['source'], 'v2')
        self.assertEqual(body['entitlements']['limits']['max_ai_agents'], 6)
        self.assertTrue(body['entitlements']['features']['payroll'])

    def test_billing_usage_me_returns_meter_totals(self):
        meter = UsageMeter.objects.create(code='ai_agents', name='AI Agents', unit='count')
        UsageRecord.objects.create(
            account=self.account,
            meter=meter,
            quantity=Decimal('4'),
            occurred_at=timezone.now(),
            source='test',
            idempotency_key='usage-1',
        )
        response = self.client.get('/api/v1/billing/usage/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertIn('meters', body)
        self.assertEqual(len(body['meters']), 1)
        self.assertEqual(body['meters'][0]['code'], 'ai_agents')
        self.assertEqual(body['meters'][0]['used'], '4.000')

    def test_usage_event_endpoint_is_idempotent(self):
        UsageMeter.objects.create(code='api_calls', name='API Calls', unit='count')
        payload = {
            'meter_code': 'api_calls',
            'quantity': '12',
            'source': 'api',
            'idempotency_key': 'evt-1',
            'meta': {'endpoint': '/v1/tasks'},
        }
        first = self.client.post('/api/v1/billing/usage/events/', payload, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(first.json()['status'], 'created')

        second = self.client.post('/api/v1/billing/usage/events/', payload, format='json')
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.json()['status'], 'duplicate')

        self.assertEqual(
            UsageRecord.objects.filter(account=self.account, meter__code='api_calls', idempotency_key='evt-1').count(),
            1,
        )

    def test_usage_refresh_endpoint_returns_summary(self):
        UsageMeter.objects.create(code='storage_gb', name='Storage', unit='gb')
        self.client.post(
            '/api/v1/billing/usage/events/',
            {
                'meter_code': 'storage_gb',
                'quantity': '3.5',
                'source': 'sync-job',
                'idempotency_key': 'evt-refresh-1',
            },
            format='json',
        )
        response = self.client.post('/api/v1/billing/usage/refresh/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertIn('meters', body)
        self.assertTrue(any(m['code'] == 'storage_gb' for m in body['meters']))

    def test_payments_me_returns_payment_history(self):
        response = self.client.get('/api/v1/billing/cabinet/payments/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertGreaterEqual(len(body), 1)
        self.assertEqual(body[0]['source'], 'test-gateway')

    def test_invoices_me_returns_invoice_list(self):
        response = self.client.get('/api/v1/billing/cabinet/invoices/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertGreaterEqual(len(body), 1)
        self.assertEqual(body[0]['number'], 'INV-TEST-0001')

    def test_timeline_me_combines_events(self):
        response = self.client.get('/api/v1/billing/cabinet/timeline/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        kinds = {item['kind'] for item in body}
        self.assertIn('payment', kinds)
        self.assertIn('invoice', kinds)

    def test_account_readiness_reports_v2_ready(self):
        response = self.client.get('/api/v1/billing/account/readiness/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertTrue(body['ready'])
        self.assertEqual(body['mode'], 'v2')
        self.assertTrue(body['checks']['has_account_v2'])
        self.assertTrue(body['checks']['has_subscription_v2'])

    @patch('apps.billing.services.requests.post')
    @patch('apps.billing.views.process_payment_webhook_event.delay')
    def test_yookassa_create_payment_intent_and_webhook(self, mock_delay, mock_post):
        with self.settings(
            YOOKASSA_SHOP_ID='test-shop',
            YOOKASSA_SECRET_KEY='test-secret',
            YOOKASSA_RETURN_URL='https://example.com/account/payments',
        ):
            provider_resp = Mock()
            provider_resp.raise_for_status = Mock()
            provider_resp.json.return_value = {
                'id': 'pay_123',
                'status': 'pending',
                'confirmation': {'confirmation_url': 'https://yookassa.test/pay_123'},
                'expires_at': '2026-03-05T10:00:00.000Z',
            }
            mock_post.return_value = provider_resp

            create_resp = self.client.post(
                '/api/v1/billing/provider/yookassa/create-payment-intent/',
                {'plan_id': self.plan.id},
                format='json',
            )
            self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
            create_body = create_resp.json()
            self.assertEqual(create_body['provider'], 'yookassa')
            self.assertEqual(create_body['provider_payment_id'], 'pay_123')
            self.assertIn('expires_at', create_body)
            self.assertTrue(PaymentTransaction.objects.filter(provider_payment_id='pay_123').exists())

            webhook_resp = self.client.post(
                '/api/v1/billing/provider/yookassa/webhook/',
                {'event': 'payment.succeeded', 'object': {'id': 'pay_123', 'status': 'succeeded'}},
                format='json',
            )
            self.assertEqual(webhook_resp.status_code, status.HTTP_200_OK)
            self.assertEqual(PaymentWebhookEvent.objects.count(), 1)
            mock_delay.assert_called_once()

    @patch('apps.billing.services.requests.post')
    @patch('apps.billing.views.process_payment_webhook_event.delay')
    @patch('apps.billing.services.PaymentProviderService.decode_yandex_pay_webhook_token')
    def test_yandex_pay_create_payment_and_webhook(self, mock_decode, mock_delay, mock_post):
        with self.settings(
            YANDEX_PAY_MERCHANT_ID='merchant-test',
            YANDEX_PAY_API_KEY='merchant-test',
            YANDEX_PAY_TEST_MODE=True,
            YANDEX_PAY_API_URL='https://sandbox.pay.yandex.ru',
            YOOKASSA_RETURN_URL='https://example.com/account/payments',
        ):
            provider_resp = Mock()
            provider_resp.raise_for_status = Mock()
            provider_resp.content = b'1'
            provider_resp.json.return_value = {
                'status': 'success',
                'data': {'paymentUrl': 'https://sandbox.pay.yandex.ru/pay/test-order'},
            }
            mock_post.return_value = provider_resp

            create_resp = self.client.post(
                '/api/v1/billing/provider/yandex-pay/create-payment/',
                {'plan_id': self.plan.id},
                format='json',
            )
            self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
            create_body = create_resp.json()
            self.assertEqual(create_body['provider'], 'yandex_pay')
            self.assertTrue(create_body['confirmation_url'])

            tx = PaymentTransaction.objects.filter(provider='yandex_pay').first()
            self.assertIsNotNone(tx)
            self.assertEqual(tx.provider_payment_id, tx.idempotency_key)

            mock_decode.return_value = {
                'merchantId': 'merchant-test',
                'event': 'ORDER_STATUS_UPDATED',
                'eventTime': timezone.now().isoformat(),
                'order': {'orderId': tx.provider_payment_id, 'paymentStatus': 'CAPTURED'},
            }
            webhook_resp = self.client.post(
                '/api/v1/billing/provider/yandex-pay/webhook/',
                data='jwt-token',
                content_type='application/octet-stream',
            )
            self.assertEqual(webhook_resp.status_code, status.HTTP_200_OK)
            self.assertEqual(PaymentWebhookEvent.objects.filter(provider='yandex_pay').count(), 1)
            mock_delay.assert_called()

    def test_webhook_processing_updates_subscription_states(self):
        tx = PaymentTransaction.objects.create(
            account=self.account,
            subscription=self.subscription,
            provider=PaymentTransaction.PROVIDER_YOOKASSA,
            provider_payment_id='pay_state_1',
            idempotency_key='r2-state-1',
            amount=Decimal('990.00'),
            currency='RUB',
            status=PaymentTransaction.STATUS_PENDING,
        )
        fail_event, _ = PaymentProviderService.ingest_webhook(
            provider='yookassa',
            payload={'event': 'payment.canceled', 'object': {'id': 'pay_state_1', 'status': 'canceled'}},
        )
        fail_result = PaymentProviderService.process_webhook_event(fail_event)
        self.assertTrue(fail_result['ok'])
        self.subscription.refresh_from_db()
        self.account.refresh_from_db()
        self.assertEqual(self.subscription.status, BillingSubscription.STATUS_PAST_DUE)
        self.assertEqual(self.account.status, BillingAccount.STATUS_ACTIVE)

        # Имитируем истечение grace-периода.
        meta = dict(self.subscription.meta or {})
        meta['past_due_since'] = (timezone.now() - timedelta(hours=120)).isoformat()
        self.subscription.meta = meta
        self.subscription.save(update_fields=['meta', 'updated_at'])
        with self.settings(BILLING_GRACE_PERIOD_HOURS=72):
            enforce_result = enforce_subscription_access_states()
        self.assertGreaterEqual(enforce_result['suspended'], 1)
        self.subscription.refresh_from_db()
        self.account.refresh_from_db()
        self.assertEqual(self.subscription.status, BillingSubscription.STATUS_SUSPENDED)
        self.assertEqual(self.account.status, BillingAccount.STATUS_SUSPENDED)

        success_event, _ = PaymentProviderService.ingest_webhook(
            provider='yookassa',
            payload={'event': 'payment.succeeded', 'object': {'id': 'pay_state_1', 'status': 'succeeded'}},
        )
        success_result = PaymentProviderService.process_webhook_event(success_event)
        self.assertTrue(success_result['ok'])
        tx.refresh_from_db()
        self.subscription.refresh_from_db()
        self.account.refresh_from_db()
        self.assertEqual(tx.status, PaymentTransaction.STATUS_SUCCEEDED)
        self.assertEqual(self.subscription.status, BillingSubscription.STATUS_ACTIVE)
        self.assertEqual(self.account.status, BillingAccount.STATUS_ACTIVE)

    @patch('apps.billing.tasks.send_email_message.delay')
    @patch('apps.billing.tasks.send_telegram_message.delay')
    def test_dunning_notifications_increment_attempts(self, mock_tg_delay, mock_email_delay):
        self.subscription.status = BillingSubscription.STATUS_PAST_DUE
        self.subscription.meta = {
            'past_due_since': (timezone.now() - timedelta(hours=3)).isoformat(),
            'past_due_reason': 'failed',
        }
        self.subscription.save(update_fields=['status', 'meta', 'updated_at'])
        with self.settings(BILLING_DUNNING_SCHEDULE_HOURS=[1, 24, 48]):
            result = process_dunning_notifications()
        self.assertGreaterEqual(result['notified'], 1)
        self.subscription.refresh_from_db()
        self.assertEqual((self.subscription.meta or {}).get('dunning_attempts'), 1)
        self.assertGreaterEqual(Notification.objects.filter(user=self.user).count(), 1)
        mock_email_delay.assert_called()
        mock_tg_delay.assert_not_called()

    @patch('apps.billing.services.PaymentProviderService.decode_yandex_pay_webhook_token')
    def test_yandex_pay_webhook_returns_401_on_invalid_jwt(self, mock_decode):
        mock_decode.side_effect = ValueError('Invalid token signature')
        resp = self.client.post(
            '/api/v1/billing/provider/yandex-pay/webhook/',
            data='broken-token',
            content_type='application/octet-stream',
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        body = resp.json()
        self.assertEqual(body.get('reasonCode'), 'UNAUTHORIZED')

    def test_duplicate_webhook_event_is_not_requeued_after_processed(self):
        tx = PaymentTransaction.objects.create(
            account=self.account,
            subscription=self.subscription,
            provider='yandex_pay',
            provider_payment_id='order_dup_1',
            idempotency_key='dup-case-1',
            amount=Decimal('500.00'),
            currency='RUB',
            status=PaymentTransaction.STATUS_PENDING,
        )
        payload = {
            'merchantId': 'merchant-test',
            'event': 'ORDER_STATUS_UPDATED',
            'eventTime': '2026-03-04T13:00:00+00:00',
            'order': {'orderId': tx.provider_payment_id, 'paymentStatus': 'CAPTURED'},
        }
        event, should_process = PaymentProviderService.ingest_webhook('yandex_pay', payload)
        self.assertTrue(should_process)
        result = PaymentProviderService.process_webhook_event(event)
        self.assertTrue(result['ok'])

        second_event, second_should_process = PaymentProviderService.ingest_webhook('yandex_pay', payload)
        self.assertEqual(second_event.id, event.id)
        self.assertFalse(second_should_process)

    def test_out_of_order_webhook_does_not_downgrade_succeeded_transaction(self):
        tx = PaymentTransaction.objects.create(
            account=self.account,
            subscription=self.subscription,
            provider='yandex_pay',
            provider_payment_id='order_ooo_1',
            idempotency_key='ooo-case-1',
            amount=Decimal('700.00'),
            currency='RUB',
            status=PaymentTransaction.STATUS_PENDING,
        )
        success_payload = {
            'merchantId': 'merchant-test',
            'event': 'ORDER_STATUS_UPDATED',
            'eventTime': '2026-03-04T13:00:01+00:00',
            'order': {'orderId': tx.provider_payment_id, 'paymentStatus': 'CAPTURED'},
        }
        fail_late_payload = {
            'merchantId': 'merchant-test',
            'event': 'ORDER_STATUS_UPDATED',
            'eventTime': '2026-03-04T13:00:02+00:00',
            'order': {'orderId': tx.provider_payment_id, 'paymentStatus': 'FAILED'},
        }
        event_success, _ = PaymentProviderService.ingest_webhook('yandex_pay', success_payload)
        res_success = PaymentProviderService.process_webhook_event(event_success)
        self.assertTrue(res_success['ok'])

        event_fail, _ = PaymentProviderService.ingest_webhook('yandex_pay', fail_late_payload)
        res_fail = PaymentProviderService.process_webhook_event(event_fail)
        self.assertTrue(res_fail['ok'])

        tx.refresh_from_db()
        self.subscription.refresh_from_db()
        self.account.refresh_from_db()
        self.assertEqual(tx.status, PaymentTransaction.STATUS_SUCCEEDED)
        self.assertEqual(self.subscription.status, BillingSubscription.STATUS_ACTIVE)
        self.assertEqual(self.account.status, BillingAccount.STATUS_ACTIVE)

    @patch('apps.billing.services.requests.post')
    def test_r3_s5_smoke_payment_lifecycle_and_account_api(self, mock_post):
        with self.settings(
            YANDEX_PAY_MERCHANT_ID='merchant-test',
            YANDEX_PAY_API_KEY='merchant-test',
            YANDEX_PAY_TEST_MODE=True,
            YANDEX_PAY_API_URL='https://sandbox.pay.yandex.ru',
            YOOKASSA_RETURN_URL='https://example.com/account/payments',
        ):
            provider_resp = Mock()
            provider_resp.raise_for_status = Mock()
            provider_resp.content = b'1'
            provider_resp.json.return_value = {
                'status': 'success',
                'data': {'paymentUrl': 'https://sandbox.pay.yandex.ru/pay/smoke-order'},
            }
            mock_post.return_value = provider_resp

            create_resp = self.client.post(
                '/api/v1/billing/provider/yandex-pay/create-payment/',
                {'plan_id': self.plan.id},
                format='json',
            )
            self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
            create_body = create_resp.json()
            self.assertEqual(create_body['provider'], 'yandex_pay')
            self.assertTrue(create_body['confirmation_url'])
            tx = PaymentTransaction.objects.get(pk=create_body['transaction_id'])

            success_payload = {
                'merchantId': 'merchant-test',
                'event': 'ORDER_STATUS_UPDATED',
                'eventTime': timezone.now().isoformat(),
                'order': {'orderId': tx.provider_payment_id, 'paymentStatus': 'CAPTURED'},
            }
            success_event, should_process = PaymentProviderService.ingest_webhook('yandex_pay', success_payload)
            self.assertTrue(should_process)
            success_result = PaymentProviderService.process_webhook_event(success_event)
            self.assertTrue(success_result['ok'])

            tx.refresh_from_db()
            self.subscription.refresh_from_db()
            self.assertEqual(tx.status, PaymentTransaction.STATUS_SUCCEEDED)
            self.assertEqual(self.subscription.status, BillingSubscription.STATUS_ACTIVE)
            self.assertIsNotNone(self.subscription.current_period_end)

            tx_failed = PaymentTransaction.objects.create(
                account=self.account,
                subscription=self.subscription,
                provider='yandex_pay',
                provider_payment_id='smoke_failed_order',
                idempotency_key='smoke-failed-key',
                amount=Decimal('1200.00'),
                currency='RUB',
                status=PaymentTransaction.STATUS_PENDING,
            )
            fail_payload = {
                'merchantId': 'merchant-test',
                'event': 'ORDER_STATUS_UPDATED',
                'eventTime': (timezone.now() + timedelta(seconds=1)).isoformat(),
                'order': {'orderId': tx_failed.provider_payment_id, 'paymentStatus': 'FAILED'},
            }
            fail_event, should_process_fail = PaymentProviderService.ingest_webhook('yandex_pay', fail_payload)
            self.assertTrue(should_process_fail)
            fail_result = PaymentProviderService.process_webhook_event(fail_event)
            self.assertTrue(fail_result['ok'])

            self.subscription.refresh_from_db()
            self.account.refresh_from_db()
            self.assertEqual(self.subscription.status, BillingSubscription.STATUS_PAST_DUE)
            self.assertEqual(self.account.status, BillingAccount.STATUS_ACTIVE)

            me_resp = self.client.get('/api/v1/billing/account/me/')
            self.assertEqual(me_resp.status_code, status.HTTP_200_OK)
            me_body = me_resp.json()
            self.assertEqual(me_body['status'], BillingSubscription.STATUS_PAST_DUE)
            self.assertEqual(me_body['entitlements']['access_mode'], 'grace')
