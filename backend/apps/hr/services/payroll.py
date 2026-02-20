"""
Payroll Service (HR-SPRINT 4): отчёт по неоплаченным часам и выплаты.
"""
from collections import defaultdict
from decimal import Decimal
from datetime import datetime, time

from django.db import transaction
from django.utils import timezone

from apps.timetracking.models import TimeLog
from apps.hr.models import Contact
from apps.todo.models import Project
from apps.finance.models import Transaction
from apps.finance.services import FinanceService, InsufficientFundsError


# Разрешаем овердрафт при выплате зарплаты (MVP)
PAYROLL_ALLOW_OVERDRAFT = True


def _log_amount(timelog, contact):
    """Рассчитать сумму по одному логу: amount → hourly_rate * hours → contact.tariff_rate * hours."""
    minutes = timelog.duration_minutes or 0
    hours = Decimal(minutes) / Decimal(60)
    if timelog.amount is not None and timelog.amount > 0:
        return timelog.amount
    rate = timelog.hourly_rate
    if rate is None or rate == 0:
        rate = (contact.tariff_rate or Decimal('0')) if contact else Decimal('0')
    return (rate * hours).quantize(Decimal('0.01'))


def _contact_display_name(contact):
    name = f"{contact.first_name or ''} {contact.last_name or ''}".strip()
    return name or contact.email or f"Contact #{contact.id}"


class PayrollService:
    """Сервис ведомости и выплат."""

    @staticmethod
    def get_payroll_report(workspace_id, start_date, end_date):
        """
        Агрегированный отчёт по неоплаченным TimeLog в workspace за период.
        Фильтр по started_at (дата логирования). Группировка по Contact и Project.
        """
        if isinstance(start_date, datetime):
            start_dt = start_date
        else:
            start_dt = datetime.combine(start_date, time.min)
        if isinstance(end_date, datetime):
            end_dt = end_date
        else:
            end_dt = datetime.combine(end_date, time.max)

        logs = (
            TimeLog.objects.filter(
                is_paid=False,
                workitem__project__workspace_id=workspace_id,
                started_at__gte=start_dt,
                started_at__lte=end_dt,
            )
            .select_related('workitem', 'user', 'workitem__project')
            .order_by('started_at')
        )

        # (contact_id, project_id) -> { contact, project, total_hours, total_amount, log_ids }
        by_contact_project = defaultdict(lambda: {
            'contact': None,
            'project': None,
            'total_hours': Decimal('0'),
            'total_amount': Decimal('0'),
            'log_ids': [],
        })
        seen_contacts = {}

        for log in logs:
            project = log.workitem.project
            contact = Contact.objects.filter(
                workspace_id=workspace_id,
                user=log.user,
            ).first()
            if not contact:
                continue
            key = (contact.id, project.id)
            if key not in by_contact_project or by_contact_project[key]['contact'] is None:
                by_contact_project[key]['contact'] = contact
                by_contact_project[key]['project'] = project
            row = by_contact_project[key]
            minutes = log.duration_minutes or 0
            row['total_hours'] += Decimal(minutes) / Decimal(60)
            amt = _log_amount(log, contact)
            row['total_amount'] += amt
            row['log_ids'].append(log.id)

        # Группировать по contact: список projects
        by_contact = defaultdict(list)
        for (cid, pid), data in by_contact_project.items():
            if data['contact'] is None:
                continue
            by_contact[data['contact']].append({
                'project': data['project'],
                'total_hours': data['total_hours'],
                'total_amount': data['total_amount'],
                'log_ids': data['log_ids'],
            })

        result = []
        for contact, projects in by_contact.items():
            result.append({
                'contact': contact,
                'projects': projects,
            })
        return result

    @staticmethod
    @transaction.atomic
    def process_payout(workspace_id, project_id, contact_id, start_date, end_date, log_ids=None, actor=None):
        """
        Выплата по контакту и проекту за период. Атомарно: транзакция + обновление логов.
        Защита от двойной оплаты: все log_ids должны иметь is_paid=False.
        """
        from rest_framework.exceptions import ValidationError

        project = Project.objects.filter(id=project_id, workspace_id=workspace_id).first()
        if not project:
            raise ValidationError({'project_id': 'Проект не найден или не принадлежит workspace.'})
        contact = Contact.objects.filter(id=contact_id, workspace_id=workspace_id).first()
        if not contact:
            raise ValidationError({'contact_id': 'Контакт не найден или не принадлежит workspace.'})

        if isinstance(start_date, datetime):
            start_dt = start_date
        else:
            start_dt = datetime.combine(start_date, time.min)
        if isinstance(end_date, datetime):
            end_dt = end_date
        else:
            end_dt = datetime.combine(end_date, time.max)

        if log_ids is not None:
            logs = TimeLog.objects.filter(
                id__in=log_ids,
                is_paid=False,
                workitem__project_id=project_id,
                user=contact.user,
                started_at__gte=start_dt,
                started_at__lte=end_dt,
            ).select_related('workitem', 'user')
        else:
            logs = TimeLog.objects.filter(
                is_paid=False,
                workitem__project_id=project_id,
                user=contact.user,
                started_at__gte=start_dt,
                started_at__lte=end_dt,
            ).select_related('workitem', 'user')

        logs = list(logs)
        if not logs:
            raise ValidationError({'detail': 'Нет неоплаченных логов для указанного периода и контакта.'})

        if log_ids and len(logs) != len(log_ids):
            already_paid_ids = set(log_ids) - {log.id for log in logs}
            if already_paid_ids:
                raise ValidationError({
                    'detail': 'Часть логов уже оплачена. Повторная выплата запрещена.',
                    'log_ids': list(already_paid_ids),
                })

        total_amount = Decimal('0')
        for log in logs:
            total_amount += _log_amount(log, contact)
        total_amount = total_amount.quantize(Decimal('0.01'))

        if not PAYROLL_ALLOW_OVERDRAFT:
            balance = FinanceService.get_project_balance(project_id)
            if balance['available'] < total_amount:
                raise InsufficientFundsError(
                    f"Недостаточно средств. Доступно: {balance['available']}, к выплате: {total_amount}"
                )

        date_range_str = f"{start_date}–{end_date}" if start_date != end_date else str(start_date)
        contact_name = _contact_display_name(contact)
        description = f"Payroll: {contact_name} ({date_range_str})"

        spend = Transaction.objects.create(
            project=project,
            workspace=getattr(project, 'workspace', None),
            type=Transaction.TYPE_SPEND,
            status=Transaction.STATUS_COMPLETED,
            amount=total_amount,
            currency='RUB',
            description=description,
            related_workitem=None,
            related_timelog=None,
            payroll_contact=contact,
            created_by=actor,
        )

        now = timezone.now()
        TimeLog.objects.filter(id__in=[log.id for log in logs]).update(is_paid=True, paid_at=now)

        return {
            'transaction_id': spend.id,
            'amount': total_amount,
            'log_count': len(logs),
        }
