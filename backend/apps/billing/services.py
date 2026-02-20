"""
Billing services — Invoice generation, PDF rendering, Subscription limits (SaaS Sprint 2).
"""
from decimal import Decimal
from datetime import date
from collections import defaultdict

from django.core.files.base import ContentFile
from django.template.loader import render_to_string
from django.utils import timezone

from .models import Invoice, Subscription
from apps.timetracking.models import TimeLog
from apps.todo.models import Project


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
        if limit == 0:
            return True  # 0 = без лимита (enterprise / superuser)
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
