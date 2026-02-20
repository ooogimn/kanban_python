"""
ViewSet для HR: Contact, Invite (HR-SPRINT 3), Payroll (HR-SPRINT 4).
Employee, Leave, PayrollRun — HR & Payroll Phase 1.
"""
from datetime import datetime, timedelta

from django.conf import settings as django_settings
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import WorkspaceMember, Workspace
from apps.auth.permissions import IsDirector, IsDirectorOrManager
from apps.billing.services import SubscriptionService
from apps.finance.services import InsufficientFundsError

from .models import Contact, Department, EmployeeDocument, EmployeeProfile, LeaveRequest, PayrollRun, PayrollItem
from .serializers import (
    ContactSerializer,
    ContactDetailSerializer,
    DepartmentSerializer,
    EmployeeDocumentSerializer,
    EmployeeDocumentCreateSerializer,
    EmployeeProfileSerializer,
    LeaveRequestSerializer,
    PayrollRunSerializer,
    PayrollRunCreateSerializer,
    PayrollRunCommitSerializer,
)
from .permissions import ContactPermission, is_manager_for_contact
from .services import create_invitation, PayrollRunService
from .services.payroll import PayrollService


class ContactViewSet(viewsets.ModelViewSet):
    """
    CRUD контактов HR.
    Обязательный фильтр: ?workspace_id=X. Без workspace_id при list — 400.
    Чтение — всем участникам workspace; запись — Owner/Директор/Guarantor.
    """
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated, ContactPermission]

    def get_queryset(self):
        workspace_id = self.request.query_params.get('workspace_id')
        if not workspace_id:
            return Contact.objects.none()
        try:
            workspace_id = int(workspace_id)
        except (ValueError, TypeError):
            return Contact.objects.none()
        user = self.request.user
        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        )
        if not workspace_ids and getattr(user, 'is_staff', False):
            workspace_ids = list(Workspace.objects.values_list('id', flat=True))
        if workspace_id not in workspace_ids:
            return Contact.objects.none()
        return (
            Contact.objects.filter(workspace_id=workspace_id)
            .select_related('workspace', 'user', 'guarantor')
            .order_by('super_group', 'last_name', 'first_name')
        )

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ContactDetailSerializer
        return ContactSerializer

    def list(self, request, *args, **kwargs):
        if not request.query_params.get('workspace_id'):
            return Response(
                {'detail': 'Обязательный параметр: workspace_id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        """Проверка лимита max_system_contacts при создании системного контакта (SaaS Sprint 2)."""
        super_group = (request.data or {}).get('super_group') if request.data else None
        if super_group == Contact.SUPER_GROUP_SYSTEM:
            if not SubscriptionService.check_limit(request.user, 'max_system_contacts'):
                return Response(
                    {
                        'code': 'LIMIT_REACHED',
                        'detail': 'Достигнут лимит сотрудников на вашем тарифе. Улучшите план для добавления новых.',
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['get'], url_path='payouts')
    def payouts(self, request, pk=None):
        """
        История выплат по контакту (SPEND с payroll_contact). Только Director/Manager.
        """
        from apps.auth.permissions import IsDirectorOrManager
        if not IsDirectorOrManager().has_permission(request, self):
            return Response({'detail': 'Нет прав на просмотр выплат.'}, status=status.HTTP_403_FORBIDDEN)
        contact = self.get_object()
        workspace_id = request.query_params.get('workspace_id')
        if not workspace_id or int(workspace_id) != contact.workspace_id:
            return Response({'detail': 'workspace_id обязателен и должен совпадать с workspace контакта.'}, status=status.HTTP_400_BAD_REQUEST)
        from apps.finance.models import Transaction
        qs = (
            Transaction.objects.filter(
                type=Transaction.TYPE_SPEND,
                payroll_contact_id=contact.id,
            )
            .select_related('project')
            .order_by('-created_at')
        )
        out = [
            {
                'id': t.id,
                'created_at': t.created_at.isoformat(),
                'amount': str(t.amount),
                'project': {'id': t.project_id, 'name': t.project.name},
            }
            for t in qs
        ]
        return Response(out, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='timelogs')
    def timelogs(self, request, pk=None):
        """
        Последние 10 TimeLog по контакту (user контакта, проекты в workspace).
        Для теневого контакта — пустой список.
        """
        contact = self.get_object()
        workspace_id = request.query_params.get('workspace_id')
        if not workspace_id or int(workspace_id) != contact.workspace_id:
            return Response({'detail': 'workspace_id обязателен и должен совпадать с workspace контакта.'}, status=status.HTTP_400_BAD_REQUEST)
        if not contact.user_id:
            return Response([], status=status.HTTP_200_OK)
        from apps.timetracking.models import TimeLog
        logs = (
            TimeLog.objects.filter(
                user_id=contact.user_id,
                workitem__project__workspace_id=contact.workspace_id,
            )
            .select_related('workitem', 'workitem__project')
            .order_by('-started_at')[:10]
        )
        out = [
            {
                'id': log.id,
                'started_at': log.started_at.isoformat(),
                'duration_minutes': log.duration_minutes,
                'description': log.description or '',
                'workitem': {'id': log.workitem_id, 'title': log.workitem.title},
                'project': {'id': log.workitem.project_id, 'name': log.workitem.project.name},
            }
            for log in logs
        ]
        return Response(out, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='invite')
    def invite(self, request, pk=None):
        """
        Отправить приглашение теневому контакту (с email).
        Возвращает invite_url для регистрации (срок 48ч).
        """
        contact = self.get_object()
        if not is_manager_for_contact(request.user, contact):
            return Response({'detail': 'Нет прав на приглашение этого контакта.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            inv = create_invitation(contact, request.user)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        frontend_url = (getattr(django_settings, 'FRONTEND_URL', None) or '').rstrip('/')
        invite_url = f"{frontend_url}/register?token={inv.token}"
        return Response({'invite_url': invite_url}, status=status.HTTP_200_OK)


def _payroll_contact_to_dict(contact, request):
    """Сериализация контакта для ответа payroll/stats/."""
    avatar_url = None
    if contact.user and contact.user.avatar:
        avatar_url = request.build_absolute_uri(contact.user.avatar.url) if request else contact.user.avatar.url
    return {
        'id': contact.id,
        'first_name': contact.first_name or '',
        'last_name': contact.last_name or '',
        'avatar_url': avatar_url,
        'user': contact.user_id,
    }


class PayrollStatsView(APIView):
    """GET /api/v1/hr/payroll/stats/ — отчёт по неоплаченным часам за период."""
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        from apps.auth.permissions import IsDirectorOrManager
        return [IsAuthenticated(), IsDirectorOrManager()]

    def get(self, request):
        if not SubscriptionService.has_feature(request.user, 'payroll'):
            return Response(
                {'code': 'FEATURE_LOCKED', 'detail': 'Модуль «Зарплата» недоступен на вашем тарифе.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        workspace_id = request.query_params.get('workspace_id')
        if not workspace_id:
            return Response({'detail': 'Обязательный параметр: workspace_id.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            workspace_id = int(workspace_id)
        except (ValueError, TypeError):
            return Response({'detail': 'Некорректный workspace_id.'}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        if not WorkspaceMember.objects.filter(workspace_id=workspace_id, user=user).exists() and not getattr(user, 'is_staff', False):
            return Response({'detail': 'Нет доступа к workspace.'}, status=status.HTTP_403_FORBIDDEN)
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if not start_date or not end_date:
            today = datetime.now().date()
            start_date = today.replace(day=1)
            end_date = today
        else:
            try:
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            except ValueError:
                return Response({'detail': 'Даты в формате YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
        report = PayrollService.get_payroll_report(workspace_id, start_date, end_date)
        result = []
        for item in report:
            contact = item['contact']
            result.append({
                'contact': _payroll_contact_to_dict(contact, request),
                'projects': [
                    {
                        'project': {'id': p['project'].id, 'name': p['project'].name},
                        'total_hours': float(p['total_hours']),
                        'total_amount': str(p['total_amount']),
                        'log_ids': p['log_ids'],
                    }
                    for p in item['projects']
                ],
            })
        return Response(result, status=status.HTTP_200_OK)


class PayrollPayView(APIView):
    """POST /api/v1/hr/payroll/pay/ — выполнить выплату."""
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        from apps.auth.permissions import IsDirectorOrManager
        return [IsAuthenticated(), IsDirectorOrManager()]

    def post(self, request):
        if not SubscriptionService.has_feature(request.user, 'payroll'):
            return Response(
                {'code': 'FEATURE_LOCKED', 'detail': 'Модуль «Зарплата» недоступен на вашем тарифе.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        data = request.data or {}
        workspace_id = data.get('workspace_id')
        project_id = data.get('project_id')
        contact_id = data.get('contact_id')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        log_ids = data.get('log_ids')
        for key, val in [('workspace_id', workspace_id), ('project_id', project_id), ('contact_id', contact_id),
                         ('start_date', start_date), ('end_date', end_date)]:
            if val is None:
                return Response({'detail': f'Обязательное поле: {key}.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            workspace_id = int(workspace_id)
            project_id = int(project_id)
            contact_id = int(contact_id)
        except (ValueError, TypeError):
            return Response({'detail': 'workspace_id, project_id, contact_id должны быть числами.'}, status=status.HTTP_400_BAD_REQUEST)
        if not WorkspaceMember.objects.filter(workspace_id=workspace_id, user=request.user).exists() and not getattr(request.user, 'is_staff', False):
            return Response({'detail': 'Нет доступа к workspace.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            return Response({'detail': 'start_date и end_date в формате YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            out = PayrollService.process_payout(
                workspace_id=workspace_id,
                project_id=project_id,
                contact_id=contact_id,
                start_date=start_date,
                end_date=end_date,
                log_ids=log_ids,
                actor=request.user,
            )
        except Exception as e:
            from rest_framework.exceptions import ValidationError
            if isinstance(e, ValidationError):
                return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
            from apps.finance.services import InsufficientFundsError
            if isinstance(e, InsufficientFundsError):
                return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            raise
        return Response({'status': 'ok', 'transaction_id': out['transaction_id'], 'amount': str(out['amount']), 'log_count': out['log_count']}, status=status.HTTP_200_OK)


# --- HR & Payroll Phase 1 ---


def _user_workspace_ids(user):
    """IDs workspace'ов, к которым есть доступ."""
    ids = list(WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True))
    if not ids and getattr(user, 'is_staff', False):
        ids = list(Workspace.objects.values_list('id', flat=True))
    return ids


class DepartmentViewSet(viewsets.ModelViewSet):
    """CRUD отделов. Admin/HR (IsDirectorOrManager)."""
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, IsDirectorOrManager]

    def get_queryset(self):
        workspace_id = self.request.query_params.get('workspace_id')
        if not workspace_id:
            return Department.objects.none()
        try:
            workspace_id = int(workspace_id)
        except (ValueError, TypeError):
            return Department.objects.none()
        if workspace_id not in _user_workspace_ids(self.request.user):
            return Department.objects.none()
        return Department.objects.filter(workspace_id=workspace_id).select_related('workspace', 'head', 'parent').order_by('name')

    def list(self, request, *args, **kwargs):
        if not request.query_params.get('workspace_id'):
            return Response({'detail': 'Обязательный параметр: workspace_id.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().list(request, *args, **kwargs)


class EmployeeViewSet(viewsets.ModelViewSet):
    """CRUD профилей сотрудников. Admin/HR (IsDirectorOrManager)."""
    serializer_class = EmployeeProfileSerializer
    permission_classes = [IsAuthenticated, IsDirectorOrManager]

    def get_queryset(self):
        workspace_id = self.request.query_params.get('workspace_id')
        if not workspace_id:
            return EmployeeProfile.objects.none()
        try:
            workspace_id = int(workspace_id)
        except (ValueError, TypeError):
            return EmployeeProfile.objects.none()
        if workspace_id not in _user_workspace_ids(self.request.user):
            return EmployeeProfile.objects.none()
        return (
            EmployeeProfile.objects.filter(member__workspace_id=workspace_id)
            .select_related('member', 'member__user', 'department', 'payment_wallet')
            .order_by('member__user__last_name', 'member__user__first_name')
        )

    def list(self, request, *args, **kwargs):
        if not request.query_params.get('workspace_id'):
            return Response({'detail': 'Обязательный параметр: workspace_id.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=['get'], url_path='timelogs')
    def timelogs(self, request, pk=None):
        """Табель посещения (TimeLog) по сотруднику. Director/Manager."""
        emp = self.get_object()
        if not emp.member or not emp.member.user_id:
            return Response([], status=status.HTTP_200_OK)
        from apps.timetracking.models import TimeLog
        logs = (
            TimeLog.objects.filter(
                user_id=emp.member.user_id,
                workitem__project__workspace_id=emp.member.workspace_id,
            )
            .select_related('workitem', 'workitem__project')
            .order_by('-started_at')[:50]
        )
        out = [
            {
                'id': log.id,
                'started_at': log.started_at.isoformat(),
                'duration_minutes': log.duration_minutes,
                'description': log.description or '',
                'workitem': {'id': log.workitem_id, 'title': log.workitem.title},
                'project': {'id': log.workitem.project_id, 'name': log.workitem.project.name},
                'is_paid': log.is_paid,
            }
            for log in logs
        ]
        return Response(out, status=status.HTTP_200_OK)


class LeaveRequestViewSet(viewsets.ModelViewSet):
    """CRUD заявок на отпуск. create проверяет overlaps. approve — только Admin/Head."""
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        workspace_id = self.request.query_params.get('workspace_id')
        if not workspace_id:
            return LeaveRequest.objects.none()
        try:
            workspace_id = int(workspace_id)
        except (ValueError, TypeError):
            return LeaveRequest.objects.none()
        if workspace_id not in _user_workspace_ids(self.request.user):
            return LeaveRequest.objects.none()
        return (
            LeaveRequest.objects.filter(member__workspace_id=workspace_id)
            .select_related('member', 'member__user', 'approved_by')
            .order_by('-created_at')
        )

    def list(self, request, *args, **kwargs):
        if not request.query_params.get('workspace_id'):
            return Response({'detail': 'Обязательный параметр: workspace_id.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """Одобрить заявку. Только Director/Manager."""
        if not IsDirectorOrManager().has_permission(request, self):
            return Response({'detail': 'Нет прав на одобрение заявок.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self.get_object()
        if obj.status != LeaveRequest.STATUS_PENDING:
            return Response({'detail': 'Заявка уже обработана.'}, status=status.HTTP_400_BAD_REQUEST)
        obj.status = LeaveRequest.STATUS_APPROVED
        obj.approved_by = request.user
        obj.save(update_fields=['status', 'approved_by', 'updated_at'])
        return Response(LeaveRequestSerializer(obj).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        """Отклонить заявку."""
        if not IsDirectorOrManager().has_permission(request, self):
            return Response({'detail': 'Нет прав.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self.get_object()
        if obj.status != LeaveRequest.STATUS_PENDING:
            return Response({'detail': 'Заявка уже обработана.'}, status=status.HTTP_400_BAD_REQUEST)
        obj.status = LeaveRequest.STATUS_REJECTED
        obj.approved_by = request.user
        obj.save(update_fields=['status', 'approved_by', 'updated_at'])
        return Response(LeaveRequestSerializer(obj).data, status=status.HTTP_200_OK)


class PayrollRunViewSet(viewsets.ModelViewSet):
    """Ведомости на выплату: preview, create, commit."""
    permission_classes = [IsAuthenticated, IsDirectorOrManager]

    def get_queryset(self):
        workspace_id = self.request.query_params.get('workspace_id')
        ids = _user_workspace_ids(self.request.user)
        qs = PayrollRun.objects.filter(workspace_id__in=ids).select_related('workspace', 'created_by')
        if workspace_id:
            try:
                wid = int(workspace_id)
                if wid in ids:
                    qs = qs.filter(workspace_id=wid)
            except (ValueError, TypeError):
                pass
        from django.db.models import Prefetch
        return qs.prefetch_related(
            Prefetch('items', queryset=PayrollItem.objects.select_related('employee', 'employee__member__user'))
        ).order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return PayrollRunCreateSerializer
        return PayrollRunSerializer

    @action(detail=False, methods=['get'], url_path='preview')
    def preview(self, request):
        """Предпросмотр расчёта за период."""
        workspace_id = request.query_params.get('workspace_id')
        period_start = request.query_params.get('period_start')
        period_end = request.query_params.get('period_end')
        if not all([workspace_id, period_start, period_end]):
            return Response(
                {'detail': 'Обязательные параметры: workspace_id, period_start, period_end.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            workspace_id = int(workspace_id)
            period_start = datetime.strptime(period_start, '%Y-%m-%d').date()
            period_end = datetime.strptime(period_end, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            return Response({'detail': 'Некорректные параметры. Даты в формате YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
        if workspace_id not in _user_workspace_ids(request.user):
            return Response({'detail': 'Нет доступа к workspace.'}, status=status.HTTP_403_FORBIDDEN)
        preview = PayrollRunService.calculate_preview(workspace_id, period_start, period_end)
        out = [
            {
                'employee_id': p['employee_id'],
                'display_name': p['display_name'],
                'gross_amount': str(p['gross_amount']),
                'net_amount': str(p['net_amount']),
                'days_worked': float(p['days_worked']) if p.get('days_worked') is not None else None,
                'hours_worked': float(p['hours_worked']) if p.get('hours_worked') is not None else None,
                'calculation_details': p['calculation_details'],
                'currency': p['currency'],
                'has_wallet': p.get('has_wallet', False),
            }
            for p in preview
        ]
        return Response(out, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        ser = PayrollRunCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        workspace_id = data['workspace_id']
        if workspace_id not in _user_workspace_ids(request.user):
            return Response({'detail': 'Нет доступа к workspace.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            run = PayrollRunService.create_run(
                workspace_id=workspace_id,
                period_start=data['period_start'],
                period_end=data['period_end'],
                created_by=request.user,
                currency=data.get('currency', 'RUB'),
            )
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PayrollRunSerializer(run).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='commit')
    def commit(self, request, pk=None):
        """Выполнить выплаты (создать транзакции)."""
        run = self.get_object()
        ser = PayrollRunCommitSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        source_wallet_id = ser.validated_data['source_wallet_id']
        try:
            result = PayrollRunService.commit_run(run.id, source_wallet_id)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except InsufficientFundsError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        run.refresh_from_db()
        return Response(PayrollRunSerializer(run).data, status=status.HTTP_200_OK)


class PayrollItemViewSet(mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Корректировка и удаление строк ведомости. Только Director, только DRAFT."""
    permission_classes = [IsAuthenticated, IsDirector]

    def get_queryset(self):
        ids = _user_workspace_ids(self.request.user)
        return (
            PayrollItem.objects.filter(payroll_run__workspace_id__in=ids)
            .select_related('payroll_run', 'employee', 'employee__member__user')
        )

    def get_serializer_class(self):
        from .serializers import PayrollItemSerializer, PayrollItemUpdateSerializer
        if self.action == 'partial_update':
            return PayrollItemUpdateSerializer
        return PayrollItemSerializer

    def partial_update(self, request, pk=None):
        item = self.get_object()
        if item.payroll_run.status != PayrollRun.STATUS_DRAFT:
            return Response(
                {'detail': 'Корректировка возможна только для ведомости в статусе Черновик.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from decimal import Decimal
        from .serializers import PayrollItemUpdateSerializer
        ser = PayrollItemUpdateSerializer(item, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        new_net = ser.validated_data.get('net_amount')
        if new_net is not None:
            item.net_amount = new_net
            item.gross_amount = new_net
            item.save(update_fields=['net_amount', 'gross_amount'])
            run = item.payroll_run
            from django.db.models import Sum
            run.total_amount = run.items.aggregate(total=Sum('net_amount'))['total'] or Decimal('0')
            run.save(update_fields=['total_amount'])
        return Response(PayrollItemSerializer(item).data, status=status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        from django.db.models import Sum
        from decimal import Decimal
        item = self.get_object()
        if item.payroll_run.status != PayrollRun.STATUS_DRAFT:
            return Response(
                {'detail': 'Удаление возможно только для ведомости в статусе Черновик.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        run = item.payroll_run
        item.delete()
        run.total_amount = run.items.aggregate(total=Sum('net_amount'))['total'] or Decimal('0')
        run.save(update_fields=['total_amount'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class EmployeeDocumentViewSet(viewsets.ModelViewSet):
    """CRUD документов сотрудника (договор, оферта и т.д.). Director/Manager."""
    permission_classes = [IsAuthenticated, IsDirectorOrManager]

    def get_queryset(self):
        employee_id = self.request.query_params.get('employee_id')
        if not employee_id:
            return EmployeeDocument.objects.none()
        try:
            employee_id = int(employee_id)
        except (ValueError, TypeError):
            return EmployeeDocument.objects.none()
        emp = EmployeeProfile.objects.filter(id=employee_id).select_related('member').first()
        if not emp or emp.member.workspace_id not in _user_workspace_ids(self.request.user):
            return EmployeeDocument.objects.none()
        return EmployeeDocument.objects.filter(employee_id=employee_id).order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return EmployeeDocumentCreateSerializer
        return EmployeeDocumentSerializer

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        if 'file' not in request.FILES and 'file' not in data:
            return Response({'detail': 'Файл обязателен.'}, status=status.HTTP_400_BAD_REQUEST)
        if request.FILES.get('file'):
            data['file'] = request.FILES['file']
        ser = EmployeeDocumentCreateSerializer(data=data)
        ser.is_valid(raise_exception=True)
        doc = ser.save()
        return Response(EmployeeDocumentSerializer(doc, context={'request': request}).data, status=status.HTTP_201_CREATED)

    def list(self, request, *args, **kwargs):
        if not request.query_params.get('employee_id'):
            return Response({'detail': 'Обязательный параметр: employee_id.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().list(request, *args, **kwargs)
