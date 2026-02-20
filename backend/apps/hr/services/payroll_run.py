"""
Payroll Run Service — расчёт и выплата по EmployeeProfile.
Phase 1: FIXED (proration) + HOURLY (TimeLog).
"""
from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.finance.models import Wallet
from apps.finance.services import TransactionService, InsufficientFundsError
from apps.timetracking.models import TimeLog

from ..models import (
    Department,
    EmployeeProfile,
    LeaveRequest,
    PayrollRun,
    PayrollItem,
)

STANDARD_WORK_DAYS = 21


def _employee_display_name(emp: EmployeeProfile) -> str:
    user = emp.member.user if emp.member_id else None
    if user:
        return user.get_full_name() or user.username or f"Employee #{emp.pk}"
    return f"Employee #{emp.pk}"


def _count_unpaid_leave_days(member_id: int, start_date, end_date) -> int:
    """Количество дней UNPAID отпуска (APPROVED) в периоде."""
    qs = LeaveRequest.objects.filter(
        member_id=member_id,
        type=LeaveRequest.TYPE_UNPAID,
        status=LeaveRequest.STATUS_APPROVED,
    ).exclude(end_date__lt=start_date).exclude(start_date__gt=end_date)
    total = 0
    for lr in qs:
        overlap_start = max(lr.start_date, start_date)
        overlap_end = min(lr.end_date, end_date)
        days = (overlap_end - overlap_start).days + 1
        total += max(0, days)
    return total


def _sum_hours_for_employee(user_id: int, workspace_id: int, start_dt, end_dt) -> Decimal:
    """Сумма часов TimeLog по user в workspace за период."""
    result = TimeLog.objects.filter(
        user_id=user_id,
        workitem__project__workspace_id=workspace_id,
        started_at__gte=start_dt,
        started_at__lte=end_dt,
    ).aggregate(total=Sum('duration_minutes'))
    minutes = result['total'] or 0
    return Decimal(minutes) / Decimal(60)


class PayrollService:
    """Сервис ведомостей (EmployeeProfile)."""

    @staticmethod
    def calculate_preview(workspace_id: int, start_date, end_date) -> list[dict]:
        """
        Предпросмотр расчёта за период.
        Returns list of dicts: employee, gross_amount, net_amount, days_worked, hours_worked, calculation_details, currency.
        """
        if isinstance(start_date, datetime):
            start_dt = start_date
        else:
            start_dt = datetime.combine(start_date, datetime.min.time())
        if isinstance(end_date, datetime):
            end_dt = end_date
        else:
            end_dt = datetime.combine(end_date, datetime.max.time())

        standard_days = STANDARD_WORK_DAYS
        employees = (
            EmployeeProfile.objects.filter(
                member__workspace_id=workspace_id,
                status=EmployeeProfile.STATUS_ACTIVE,
            )
            .select_related('member', 'member__user', 'department')
        )

        preview = []
        for emp in employees:
            if not emp.salary_amount or emp.salary_amount <= 0:
                continue

            fte = emp.fte or Decimal('1')
            currency = emp.currency or 'RUB'
            gross = Decimal('0')
            net = Decimal('0')
            days_worked = None
            hours_worked = None
            details = {}

            if emp.salary_mode == EmployeeProfile.SALARY_FIXED:
                unpaid_days = _count_unpaid_leave_days(emp.member_id, start_date, end_date)
                worked_days = standard_days - unpaid_days
                if worked_days < 0:
                    worked_days = 0
                gross = (emp.salary_amount * fte / Decimal(standard_days) * Decimal(worked_days)).quantize(Decimal('0.01'))
                net = gross
                days_worked = Decimal(worked_days)
                details = {
                    "formula": f"Salary {emp.salary_amount} * FTE {fte} / {standard_days} * {worked_days}",
                    "standard_days": standard_days,
                    "unpaid_leave_days": unpaid_days,
                    "worked_days": worked_days,
                }
            else:
                hours = _sum_hours_for_employee(
                    emp.member.user_id,
                    workspace_id,
                    start_dt,
                    end_dt,
                )
                rate = emp.salary_amount or Decimal('0')
                gross = (rate * hours).quantize(Decimal('0.01'))
                net = gross
                hours_worked = hours
                details = {
                    "formula": f"Rate {rate} * {float(hours):.2f} hours",
                    "hours": float(hours),
                }

            if gross > 0:
                preview.append({
                    "employee": emp,
                    "employee_id": emp.pk,
                    "gross_amount": gross,
                    "net_amount": net,
                    "days_worked": days_worked,
                    "hours_worked": hours_worked,
                    "calculation_details": details,
                    "currency": currency,
                    "display_name": _employee_display_name(emp),
                    "payment_wallet_id": emp.payment_wallet_id,
                    "has_wallet": bool(emp.payment_wallet_id),
                })

        return preview

    @staticmethod
    @transaction.atomic
    def create_run(
        workspace_id: int,
        period_start,
        period_end,
        created_by,
        currency: str = 'RUB',
    ) -> PayrollRun:
        """Создать PayrollRun + PayrollItem в статусе DRAFT."""
        preview = PayrollService.calculate_preview(workspace_id, period_start, period_end)
        total = sum(p['net_amount'] for p in preview)

        run = PayrollRun.objects.create(
            workspace_id=workspace_id,
            period_start=period_start,
            period_end=period_end,
            total_amount=total,
            currency=currency,
            status=PayrollRun.STATUS_DRAFT,
            created_by=created_by,
        )

        for p in preview:
            PayrollItem.objects.create(
                payroll_run=run,
                employee=p['employee'],
                gross_amount=p['gross_amount'],
                net_amount=p['net_amount'],
                days_worked=p['days_worked'],
                hours_worked=p['hours_worked'],
                calculation_details=p['calculation_details'],
                is_paid=False,
            )

        return run

    @staticmethod
    @transaction.atomic
    def commit_run(run_id: int, source_wallet_id: int) -> dict:
        """
        Выполнить выплаты: создать транзакции и обновить статус.
        Fails if any employee has no payment_wallet.
        """
        run = PayrollRun.objects.select_related('workspace').get(pk=run_id)
        if run.status != PayrollRun.STATUS_DRAFT:
            raise ValueError(f'PayrollRun {run_id} is not in DRAFT status.')

        source = Wallet.objects.select_for_update().get(pk=source_wallet_id)
        if source.workspace_id != run.workspace_id:
            raise ValueError('Source wallet must belong to the same workspace.')

        total_needed = run.total_amount
        if source.balance < total_needed:
            raise InsufficientFundsError(
                f'Недостаточно средств. Баланс: {source.balance}, требуется: {total_needed}.'
            )

        items = run.items.select_related('employee', 'employee__member__user', 'employee__payment_wallet').all()
        paid_count = 0
        errors = []

        for item in items:
            emp = item.employee
            if not emp.payment_wallet_id:
                errors.append({
                    "employee_id": emp.pk,
                    "employee": _employee_display_name(emp),
                    "error": "payment_wallet не указан",
                })
                continue

            out_tx, in_tx = TransactionService.create_payroll(
                company_wallet=source,
                user_wallet=emp.payment_wallet,
                amount=item.net_amount,
                created_by=run.created_by,
                description=f"Payroll: {_employee_display_name(emp)} ({run.period_start}–{run.period_end})",
            )
            item.transaction_id = in_tx.pk
            item.is_paid = True
            item.save(update_fields=['transaction_id', 'is_paid'])
            paid_count += 1

        if errors:
            raise ValueError(
                f"Не удалось выплатить {len(errors)} сотрудникам (нет payment_wallet): {[e['employee'] for e in errors]}"
            )

        run.status = PayrollRun.STATUS_PAID
        run.paid_at = timezone.now()
        run.save(update_fields=['status', 'paid_at'])

        return {
            "run_id": run.id,
            "status": "PAID",
            "paid_count": paid_count,
            "total_amount": str(run.total_amount),
        }
