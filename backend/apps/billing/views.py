"""
Billing API — InvoiceViewSet for PDF generation.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.http import FileResponse
from django.utils import timezone

from apps.auth.permissions import IsDirectorOrManager
from .models import Invoice, PlanVersion
from .serializers import (
    InvoiceSerializer,
    InvoiceCreateSerializer,
    BillingMeResponseSerializer,
    BillingReadinessSerializer,
    BillingUsageResponseSerializer,
    YookassaPaymentIntentCreateSerializer,
    YookassaPaymentIntentResponseSerializer,
    YandexPayCreatePaymentSerializer,
    YandexPayCreatePaymentResponseSerializer,
    UsageRecordCreateSerializer,
    UsageRecordResponseSerializer,
    BillingPaymentSerializer,
    BillingInvoiceListSerializer,
    BillingTimelineItemSerializer,
)
from .services import (
    InvoiceGenerator,
    PDFRenderer,
    BillingAccountService,
    CutoverReadinessService,
    PaymentProviderService,
    EntitlementService,
    UsageService,
)
from .tasks import process_payment_webhook_event
from apps.todo.models import Project
from apps.core.models import WorkspaceMember, UserEvent


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    ViewSet для счетов.
    
    - list/retrieve: стандартно
    - create: генерирует черновик по project_id, date_start, date_end
    - generate_pdf (action): рендерит PDF и сохраняет в модель
    - download (action): отдаёт PDF файл
    - mark_as_sent (action): меняет статус на SENT
    """

    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, IsDirectorOrManager]

    def get_queryset(self):
        """Только счета по проектам из workspace пользователя."""
        user = self.request.user
        workspace_ids = WorkspaceMember.objects.filter(
            user=user
        ).values_list('workspace_id', flat=True)
        project_ids = Project.objects.filter(
            workspace_id__in=workspace_ids
        ).values_list('id', flat=True)
        return Invoice.objects.filter(
            project_id__in=project_ids
        ).select_related('project', 'customer').order_by('-date_issue', '-created_at')

    def _has_project_access(self, project):
        return WorkspaceMember.objects.filter(
            user=self.request.user,
            workspace=project.workspace,
        ).exists()

    def create(self, request, *args, **kwargs):
        """
        POST /api/v1/billing/invoices/
        
        Body: { project_id, date_start, date_end }
        Создаёт черновик счёта.
        """
        ser = InvoiceCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            project = Project.objects.get(pk=data['project_id'])
        except Project.DoesNotExist:
            return Response(
                {'error': 'Проект не найден'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not self._has_project_access(project):
            return Response(
                {'error': 'Нет доступа к проекту'},
                status=status.HTTP_403_FORBIDDEN,
            )

        invoice = InvoiceGenerator.generate_draft(
            project_id=data['project_id'],
            date_start=data['date_start'],
            date_end=data['date_end'],
            created_by=request.user,
        )

        if invoice is None:
            return Response(
                {'error': 'Нет невыставленных таймлогов за указанный период.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(invoice)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def generate_pdf(self, request, pk=None):
        """
        POST /api/v1/billing/invoices/{id}/generate_pdf/
        
        Рендерит PDF и сохраняет в invoice.pdf_file.
        """
        invoice = self.get_object()
        try:
            PDFRenderer.render_and_save(invoice)
            serializer = self.get_serializer(invoice)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': f'Ошибка генерации PDF: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """
        GET /api/v1/billing/invoices/{id}/download/
        
        Отдаёт PDF файл (application/pdf).
        Если PDF ещё не сгенерирован — генерирует и отдаёт.
        """
        invoice = self.get_object()
        if not invoice.pdf_file:
            try:
                PDFRenderer.render_and_save(invoice)
                invoice.refresh_from_db()
            except Exception as e:
                return Response(
                    {'error': f'Ошибка генерации PDF: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        if invoice.pdf_file:
            filename = f"{invoice.number.replace('/', '-')}.pdf"
            return FileResponse(
                invoice.pdf_file.open('rb'),
                as_attachment=True,
                filename=filename,
                content_type='application/pdf',
            )

        return Response(
            {'error': 'PDF не найден'},
            status=status.HTTP_404_NOT_FOUND,
        )

    @action(detail=True, methods=['post'])
    def mark_as_sent(self, request, pk=None):
        """
        POST /api/v1/billing/invoices/{id}/mark_as_sent/
        
        Меняет статус на SENT.
        """
        invoice = self.get_object()
        invoice.status = Invoice.STATUS_SENT
        invoice.save(update_fields=['status', 'updated_at'])
        serializer = self.get_serializer(invoice)
        return Response(serializer.data)


class BillingAccountViewSet(viewsets.ViewSet):
    """
    API для личного кабинета: сводка аккаунта/подписки/entitlements.
    GET /api/v1/billing/account/me/
    """
    permission_classes = [IsAuthenticated]

    PROVIDER_LABELS = {
        'yookassa': 'ЮKassa',
        'yandex_pay': 'Yandex Pay',
        'stripe': 'Stripe',
        'robokassa': 'Robokassa',
        'manual': 'Manual',
    }

    @staticmethod
    def _to_frontend_access_mode(raw_mode):
        mapping = {
            'full': 'full',
            'trial': 'trial',
            'limited': 'limited',
            'blocked': 'blocked',
            'grace': 'limited',
            'read_only': 'blocked',
        }
        return mapping.get(raw_mode, 'limited')

    @classmethod
    def _normalize_frontend_entitlement(cls, entitlements, subscription):
        raw_source = (entitlements or {}).get('source')
        source_map = {
            'v2': 'subscription',
            'legacy': 'free',
            'subscription': 'subscription',
            'free': 'free',
            'trial': 'trial',
            'override': 'override',
            'none': 'none',
        }
        source = source_map.get(raw_source, 'none')

        limits = (entitlements or {}).get('limits')
        limits = limits if isinstance(limits, dict) else {}

        features = (entitlements or {}).get('features')
        features = features if isinstance(features, dict) else {}

        restrictions = (entitlements or {}).get('restrictions')
        restrictions = restrictions if isinstance(restrictions, dict) else None

        period_raw = (entitlements or {}).get('period')
        period_raw = period_raw if isinstance(period_raw, dict) else {}
        period_start = period_raw.get('start')
        period_end = period_raw.get('end')
        trial_end = subscription.trial_end.isoformat() if (subscription and subscription.trial_end) else None

        days_left = None
        if subscription and subscription.current_period_end:
            end_date = subscription.current_period_end.date()
            days_left = max((end_date - timezone.now().date()).days, 0)

        return {
            'source': source,
            'access_mode': cls._to_frontend_access_mode((entitlements or {}).get('access_mode')),
            'limits': limits,
            'features': features,
            'restrictions': restrictions,
            'period': {
                'start': period_start,
                'end': period_end,
                'trial_end': trial_end,
                'days_left': days_left,
            },
        }

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        account = BillingAccountService.get_user_account(request.user)
        subscription = BillingAccountService.get_current_subscription(account) if account else None
        entitlements = EntitlementService.calculate(request.user, account=account, subscription=subscription)
        entitlement = self._normalize_frontend_entitlement(entitlements, subscription)
        plan_badge = None
        if subscription and subscription.plan_version:
            code = (subscription.plan_version.code or '').strip()
            plan_badge = code.split('_')[0].upper() if code else subscription.plan_version.name.upper()
        provider_raw = (subscription.provider or '').strip() if subscription else ''
        provider_display = self.PROVIDER_LABELS.get(provider_raw, provider_raw or None)
        is_read_only = bool(entitlements.get('restrictions', {}).get('billing_read_only'))
        in_grace = bool(entitlements.get('access_mode') == 'grace')
        will_cancel = bool(subscription.cancel_at_period_end) if subscription else False
        is_trial = bool(subscription and subscription.status == subscription.STATUS_TRIALING)
        sub_meta = dict(subscription.meta or {}) if subscription else {}
        status_flags = {
            'is_trial': is_trial,
            'in_grace': in_grace,
            'is_read_only': is_read_only,
            'will_cancel_at_period_end': will_cancel,
            'dunning_attempts': int(sub_meta.get('dunning_attempts', 0) or 0),
            'past_due_since': sub_meta.get('past_due_since'),
        }

        payload = {
            'account_id': account.id if account else None,
            'workspace_id': account.workspace_id if account else None,
            'workspace_name': account.workspace.name if account else None,
            'account_status': account.status if account else None,
            'account_currency': account.currency if account else None,
            'account_timezone': account.timezone if account else None,
            'subscription_id': subscription.id if subscription else None,
            'plan_code': subscription.plan_version.code if subscription and subscription.plan_version else None,
            'plan_name': subscription.plan_version.name if subscription and subscription.plan_version else None,
            'plan_interval': subscription.plan_version.interval if subscription and subscription.plan_version else None,
            'plan_price': str(subscription.plan_version.price) if subscription and subscription.plan_version else None,
            'plan_currency': subscription.plan_version.currency if subscription and subscription.plan_version else None,
            'plan_badge': plan_badge,
            'status': subscription.status if subscription else None,
            'cancel_at_period_end': bool(subscription.cancel_at_period_end) if subscription else False,
            'trial_end': subscription.trial_end if subscription else None,
            'provider': subscription.provider if subscription else None,
            'provider_subscription_id': subscription.provider_subscription_id if subscription else None,
            'period_start': subscription.current_period_start if subscription else None,
            'period_end': subscription.current_period_end if subscription else None,
            'next_billing_at': subscription.current_period_end if subscription else None,
            'provider_display': provider_display,
            'status_flags': status_flags,
            'entitlement': entitlement,
            'entitlements': entitlements,
        }
        serializer = BillingMeResponseSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)

    @action(detail=False, methods=['get'], url_path='readiness')
    def readiness(self, request):
        """
        GET /api/v1/billing/account/readiness/
        Проверка готовности пользователя к cutover legacy -> v2.
        """
        payload = CutoverReadinessService.get_user_readiness(request.user)
        serializer = BillingReadinessSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class BillingUsageViewSet(viewsets.ViewSet):
    """
    API для личного кабинета: расход ресурсов за текущий период.
    GET /api/v1/billing/usage/me/
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        summary = UsageService.get_usage_summary(request.user)
        serializer = BillingUsageResponseSerializer(data=summary)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)

    @action(detail=False, methods=['post'], url_path='events')
    def events(self, request):
        """
        POST /api/v1/billing/usage/events/
        Запись usage-события с поддержкой idempotency_key.
        """
        serializer = UsageRecordCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            record, created = UsageService.record_usage_event(
                user=request.user,
                meter_code=data['meter_code'],
                quantity=data['quantity'],
                source=data.get('source', ''),
                idempotency_key=data.get('idempotency_key', ''),
                occurred_at=data.get('occurred_at'),
                meta=data.get('meta', {}),
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        payload = {
            'id': record.id,
            'status': 'created' if created else 'duplicate',
            'meter_code': record.meter.code,
            'quantity': str(record.quantity),
            'occurred_at': record.occurred_at,
            'source': record.source,
            'idempotency_key': record.idempotency_key,
        }
        out = UsageRecordResponseSerializer(data=payload)
        out.is_valid(raise_exception=True)
        return Response(out.validated_data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='refresh')
    def refresh(self, request):
        """
        POST /api/v1/billing/usage/refresh/
        Принудительный пересчет usage summary и refresh кэша.
        """
        summary = UsageService.get_usage_summary(request.user, use_cache=True, force_refresh=True)
        serializer = BillingUsageResponseSerializer(data=summary)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class BillingCabinetViewSet(viewsets.ViewSet):
    """
    API для разделов ЛК: payments/invoices/timeline.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='payments/me')
    def payments_me(self, request):
        events = (
            UserEvent.objects.filter(user=request.user, event_type=UserEvent.EVENT_PAYMENT)
            .order_by('-created_at')
            [:200]
        )
        rows = [
            {
                'id': e.id,
                'created_at': e.created_at,
                'amount': str(e.amount or '0'),
                'currency': (e.details or {}).get('currency', 'RUB'),
                'source': (e.details or {}).get('source', 'manual'),
                'status': (e.details or {}).get('status', 'paid'),
                'description': (e.details or {}).get('note', ''),
            }
            for e in events
        ]
        serializer = BillingPaymentSerializer(rows, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='invoices/me')
    def invoices_me(self, request):
        workspace_ids = WorkspaceMember.objects.filter(user=request.user).values_list('workspace_id', flat=True)
        qs = (
            Invoice.objects.filter(project__workspace_id__in=workspace_ids)
            .select_related('project', 'customer')
            .order_by('-date_issue', '-created_at')[:200]
        )
        rows = []
        for inv in qs:
            pdf_url = request.build_absolute_uri(inv.pdf_file.url) if inv.pdf_file else None
            rows.append(
                {
                    'id': inv.id,
                    'number': inv.number,
                    'status': inv.status,
                    'date_issue': inv.date_issue,
                    'date_due': inv.date_due,
                    'amount_total': str(inv.amount_total),
                    'pdf_url': pdf_url,
                    'project_name': inv.project.name if inv.project_id else None,
                    'customer_name': inv.customer.name if inv.customer_id else None,
                }
            )
        serializer = BillingInvoiceListSerializer(rows, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='timeline/me')
    def timeline_me(self, request):
        payment_events = (
            UserEvent.objects.filter(user=request.user, event_type=UserEvent.EVENT_PAYMENT)
            .order_by('-created_at')
            [:200]
        )
        workspace_ids = WorkspaceMember.objects.filter(user=request.user).values_list('workspace_id', flat=True)
        invoices = (
            Invoice.objects.filter(project__workspace_id__in=workspace_ids)
            .select_related('project', 'customer')
            .order_by('-created_at')[:200]
        )

        items = []
        for e in payment_events:
            details = e.details or {}
            items.append(
                {
                    'id': f'payment-{e.id}',
                    'occurred_at': e.created_at,
                    'kind': 'payment',
                    'title': 'Платёж',
                    'description': details.get('note', ''),
                    'amount': str(e.amount) if e.amount is not None else None,
                    'currency': details.get('currency', 'RUB'),
                    'meta': details,
                }
            )
        for inv in invoices:
            items.append(
                {
                    'id': f'invoice-{inv.id}',
                    'occurred_at': inv.created_at,
                    'kind': 'invoice',
                    'title': f'Счёт {inv.number}',
                    'description': inv.project.name if inv.project_id else '',
                    'amount': str(inv.amount_total),
                    'currency': 'RUB',
                    'meta': {
                        'status': inv.status,
                        'date_issue': inv.date_issue.isoformat() if inv.date_issue else None,
                        'date_due': inv.date_due.isoformat() if inv.date_due else None,
                    },
                }
            )
        items.sort(key=lambda x: x['occurred_at'], reverse=True)
        serializer = BillingTimelineItemSerializer(items[:300], many=True)
        return Response(serializer.data)


class BillingProviderViewSet(viewsets.ViewSet):
    """
    R2 API: провайдер платежей (ЮKassa).
    """
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ('yookassa_webhook', 'yandex_pay_webhook'):
            return [AllowAny()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['post'], url_path='yookassa/create-payment-intent')
    def yookassa_create_payment_intent(self, request):
        serializer = YookassaPaymentIntentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        amount = data.get('amount')
        currency = data.get('currency', 'RUB')
        description = data.get('description', '')
        meta = data.get('meta', {})

        plan_id = data.get('plan_id')
        if plan_id is not None:
            plan = PlanVersion.objects.filter(pk=plan_id, is_active=True).first()
            if not plan:
                return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)
            amount = plan.price
            currency = plan.currency
            if not description:
                description = f'Plan {plan.name} ({plan.code})'
            if not isinstance(meta, dict):
                meta = {}
            meta = {**meta, 'plan_id': plan.id, 'plan_code': plan.code}

        try:
            tx, provider_response = PaymentProviderService.create_yookassa_payment_intent(
                user=request.user,
                amount=amount,
                currency=currency,
                description=description,
                return_url=data.get('return_url'),
                idempotency_key=data.get('idempotency_key', ''),
                meta=meta,
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'error': f'provider_error: {str(exc)}'}, status=status.HTTP_502_BAD_GATEWAY)

        expires_at = provider_response.get('expires_at') if isinstance(provider_response, dict) else None
        out = YookassaPaymentIntentResponseSerializer(
            data={
                'transaction_id': tx.id,
                'provider': tx.provider,
                'provider_payment_id': tx.provider_payment_id,
                'status': tx.status,
                'amount': str(tx.amount),
                'currency': tx.currency,
                'confirmation_url': tx.confirmation_url or '',
                'idempotency_key': tx.idempotency_key or '',
                'expires_at': expires_at,
            }
        )
        out.is_valid(raise_exception=True)
        return Response(out.validated_data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='yookassa/webhook')
    def yookassa_webhook(self, request):
        event, should_process = PaymentProviderService.ingest_webhook(
            provider='yookassa',
            payload=request.data if isinstance(request.data, dict) else {},
        )
        if should_process:
            process_payment_webhook_event.delay(event.id)
        return Response({'ok': True, 'event_id': event.id, 'queued': bool(should_process)})

    @action(detail=False, methods=['post'], url_path='yandex-pay/create-payment')
    def yandex_pay_create_payment(self, request):
        serializer = YandexPayCreatePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        plan = PlanVersion.objects.filter(pk=data['plan_id'], is_active=True).first()
        if not plan:
            return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)

        meta = {'plan_id': plan.id, 'plan_code': plan.code}
        try:
            tx, _provider_response = PaymentProviderService.create_yandex_pay_payment(
                user=request.user,
                amount=plan.price,
                currency=plan.currency,
                description=f'Plan {plan.name} ({plan.code})',
                return_url=data.get('return_url'),
                idempotency_key=data.get('idempotency_key', ''),
                meta=meta,
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'error': f'provider_error: {str(exc)}'}, status=status.HTTP_502_BAD_GATEWAY)

        out = YandexPayCreatePaymentResponseSerializer(
            data={
                'transaction_id': tx.id,
                'provider': tx.provider,
                'provider_payment_id': tx.provider_payment_id,
                'status': tx.status,
                'amount': str(tx.amount),
                'currency': tx.currency,
                'confirmation_url': tx.confirmation_url or '',
                'idempotency_key': tx.idempotency_key or '',
            }
        )
        out.is_valid(raise_exception=True)
        return Response(out.validated_data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='yandex-pay/webhook')
    def yandex_pay_webhook(self, request):
        token = request.body.decode('utf-8', errors='ignore').strip()
        try:
            payload = PaymentProviderService.decode_yandex_pay_webhook_token(token)
        except Exception as exc:
            return Response(
                {'status': 'fail', 'code': 401, 'reasonCode': 'UNAUTHORIZED', 'reason': str(exc)},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        event, should_process = PaymentProviderService.ingest_webhook(
            provider='yandex_pay',
            payload=payload,
        )
        if should_process:
            process_payment_webhook_event.delay(event.id)
        return Response({'ok': True, 'event_id': event.id, 'queued': bool(should_process)}, status=status.HTTP_200_OK)
