from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.core.models import Workspace, WorkspaceMember
from apps.billing.models import BillingAccount, PlanVersion, BillingSubscription, PaymentTransaction
from apps.saas.models import Plan


User = get_user_model()


class SaasRevenueDashboardApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username='saas_admin',
            email='saas_admin@example.com',
            password='pass12345',
        )
        self.client.force_authenticate(self.admin)

    def test_revenue_stats_returns_expected_contract_and_aggregates(self):
        now = timezone.now()
        owner = User.objects.create_user(username='owner1', email='owner1@example.com', password='pass12345')
        ws = Workspace.objects.create(name='WS Revenue', slug='ws-revenue', owner=owner)
        WorkspaceMember.objects.create(workspace=ws, user=owner, role=WorkspaceMember.ROLE_OWNER)
        account = BillingAccount.objects.create(workspace=ws, owner=owner, status=BillingAccount.STATUS_ACTIVE)

        plan_month = PlanVersion.objects.create(
            code='business_monthly',
            name='Business',
            version=1,
            interval=PlanVersion.INTERVAL_MONTH,
            price=Decimal('1000.00'),
            currency='RUB',
            limits_schema={},
            features_schema={},
        )
        plan_year = PlanVersion.objects.create(
            code='pro_yearly',
            name='Pro Annual',
            version=1,
            interval=PlanVersion.INTERVAL_YEAR,
            price=Decimal('12000.00'),
            currency='RUB',
            limits_schema={},
            features_schema={},
        )
        sub_active = BillingSubscription.objects.create(
            account=account,
            plan_version=plan_month,
            status=BillingSubscription.STATUS_ACTIVE,
            current_period_start=now - timedelta(days=5),
            current_period_end=now + timedelta(days=25),
            provider='yandex_pay',
        )
        BillingSubscription.objects.create(
            account=account,
            plan_version=plan_year,
            status=BillingSubscription.STATUS_TRIALING,
            current_period_start=now - timedelta(days=2),
            current_period_end=now + timedelta(days=28),
            provider='yookassa',
        )

        PaymentTransaction.objects.create(
            account=account,
            subscription=sub_active,
            provider='yandex_pay',
            provider_payment_id='yp_1',
            idempotency_key='yp_i_1',
            status=PaymentTransaction.STATUS_SUCCEEDED,
            amount=Decimal('8000.00'),
            currency='RUB',
            paid_at=now - timedelta(days=1),
        )
        PaymentTransaction.objects.create(
            account=account,
            subscription=sub_active,
            provider=PaymentTransaction.PROVIDER_YOOKASSA,
            provider_payment_id='yk_1',
            idempotency_key='yk_i_1',
            status=PaymentTransaction.STATUS_SUCCEEDED,
            amount=Decimal('2000.00'),
            currency='RUB',
            paid_at=now - timedelta(days=1),
        )

        response = self.client.get('/api/v1/saas/dashboard/revenue/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()

        self.assertIn('arr', body)
        self.assertEqual(body['arr'], '12000.00')
        self.assertEqual(body['active_subscriptions'], 1)
        self.assertEqual(body['trial_subscriptions'], 1)
        self.assertIn('churn_count', body)

        providers = {row['provider']: row for row in body['revenue_by_provider']}
        self.assertIn('yandex_pay', providers)
        self.assertIn('yookassa', providers)
        self.assertEqual(providers['yandex_pay']['total'], 8000.0)
        self.assertEqual(providers['yookassa']['total'], 2000.0)

        plans = {row['plan']: row for row in body['revenue_by_plan']}
        self.assertIn('Business', plans)
        self.assertEqual(plans['Business']['total'], 10000.0)

        self.assertGreaterEqual(len(body['revenue_by_month']), 1)

    def test_revenue_stats_returns_empty_collections_without_payments(self):
        response = self.client.get('/api/v1/saas/dashboard/revenue/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()

        self.assertEqual(body['arr'], '0.00')
        self.assertEqual(body['active_subscriptions'], 0)
        self.assertEqual(body['trial_subscriptions'], 0)
        self.assertEqual(body['revenue_by_month'], [])
        self.assertEqual(body['revenue_by_provider'], [])
        self.assertEqual(body['revenue_by_plan'], [])


class SaasPlansApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username='plans_admin',
            email='plans_admin@example.com',
            password='pass12345',
        )
        self.client.force_authenticate(self.admin)

    def test_only_one_default_plan_is_kept(self):
        p1 = Plan.objects.create(
            name='Starter',
            price=Decimal('0'),
            currency='RUB',
            limits={},
            is_active=True,
            is_default=True,
        )
        p2 = Plan.objects.create(
            name='Pro',
            price=Decimal('999'),
            currency='RUB',
            limits={},
            is_active=True,
            is_default=False,
        )

        response = self.client.patch(
            f'/api/v1/saas/plans/{p2.id}/',
            {'is_default': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        p1.refresh_from_db()
        p2.refresh_from_db()
        self.assertFalse(p1.is_default)
        self.assertTrue(p2.is_default)

    def test_recommended_fields_are_normalized(self):
        response = self.client.post(
            '/api/v1/saas/plans/',
            {
                'name': 'Student',
                'price': '490',
                'currency': 'RUB',
                'limits': {},
                'is_active': True,
                'is_default': False,
                'is_recommended': True,
                'recommended_badge': '',
                'recommended_note': 'для студентов',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertTrue(body['is_recommended'])
        self.assertEqual(body['recommended_badge'], 'РЕКОМЕНДОВАН')
        self.assertEqual(body['recommended_note'], 'для студентов')
