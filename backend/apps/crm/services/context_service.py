"""
Customer Context Service для агрегации данных клиента (Task 2.1).

Собирает "Досье клиента" для принятия решений и работы ИИ-агентов.
Использует SQL aggregation для производительности (без циклов Python).
"""
import logging
from decimal import Decimal

from django.db.models import Count, Sum, Q, F
from django.db.models.functions import Coalesce

logger = logging.getLogger(__name__)


class CustomerContextService:
    """Сервис для сбора контекста клиента (CRM-Lite + AI Context)."""
    
    @staticmethod
    def get_customer_dossier(customer):
        """
        Формирование досье клиента с агрегированными данными.
        
        Возвращает dict с:
        - info: базовые данные клиента
        - stats: агрегированная статистика (SQL, без N+1)
        - context_summary: текстовое резюме для ИИ
        
        Args:
            customer: экземпляр модели Customer
            
        Returns:
            dict: полное досье клиента
        """
        from apps.todo.models import Project, WorkItem
        
        # Базовая информация
        info = {
            'id': customer.id,
            'name': customer.name,
            'status': customer.status,
            'contact_email': customer.contact_email,
            'telegram_username': customer.telegram_username,
            'notes': customer.notes,
            'workspace_id': customer.workspace_id,
            'created_at': customer.created_at.isoformat() if customer.created_at else None,
        }
        
        # Агрегированная статистика (SQL, без циклов Python)
        projects_qs = Project.objects.filter(customer=customer)
        
        # Статистика проектов
        project_stats = projects_qs.aggregate(
            total_projects=Count('id'),
            active_projects=Count('id', filter=Q(status=Project.STATUS_ACTIVE)),
            total_budget=Coalesce(Sum('budget_total'), Decimal('0')),
            total_spent=Coalesce(Sum('budget_spent'), Decimal('0')),
            risk_projects_count=Count(
                'id',
                filter=Q(last_budget_alert_level__gte=Project.BUDGET_ALERT_WARNING)
            )
        )
        
        # Статистика задач (через проекты клиента)
        task_stats = WorkItem.objects.filter(
            project__customer=customer,
            deleted_at__isnull=True
        ).aggregate(
            open_tasks_count=Count(
                'id',
                filter=Q(
                    status__in=[
                        WorkItem.STATUS_TODO,
                        WorkItem.STATUS_IN_PROGRESS,
                        WorkItem.STATUS_REVIEW
                    ]
                )
            ),
            completed_tasks_count=Count(
                'id',
                filter=Q(status=WorkItem.STATUS_COMPLETED)
            ),
            overdue_tasks_count=Count(
                'id',
                filter=Q(
                    deadline_notification_sent=WorkItem.ALERT_OVERDUE,
                    status__in=[
                        WorkItem.STATUS_TODO,
                        WorkItem.STATUS_IN_PROGRESS,
                        WorkItem.STATUS_REVIEW
                    ]
                )
            )
        )
        
        stats = {
            'total_projects': project_stats['total_projects'],
            'active_projects': project_stats['active_projects'],
            'total_budget': float(project_stats['total_budget']),
            'total_spent': float(project_stats['total_spent']),
            'risk_projects_count': project_stats['risk_projects_count'],
            'open_tasks_count': task_stats['open_tasks_count'],
            'completed_tasks_count': task_stats['completed_tasks_count'],
            'overdue_tasks_count': task_stats['overdue_tasks_count'],
        }
        
        # Контекстное резюме для ИИ
        context_summary = CustomerContextService._generate_context_summary(
            customer, stats
        )
        
        return {
            'info': info,
            'stats': stats,
            'context_summary': context_summary,
        }
    
    @staticmethod
    def _generate_context_summary(customer, stats):
        """
        Генерация текстового резюме для ИИ-агентов.
        
        Args:
            customer: экземпляр Customer
            stats: dict со статистикой
            
        Returns:
            str: текстовое резюме
        """
        status_map = {
            'lead': 'Лид',
            'active': 'Активный',
            'archived': 'Архивный'
        }
        status_text = status_map.get(customer.status, customer.status)
        
        summary_parts = [
            f"Клиент: {customer.name} ({status_text}).",
        ]
        
        # Проекты
        total_projects = stats['total_projects']
        active_projects = stats['active_projects']
        if total_projects > 0:
            summary_parts.append(
                f"Проектов: {total_projects} (активных: {active_projects})."
            )
        else:
            summary_parts.append("Проектов нет.")
        
        # Бюджет
        total_budget = stats['total_budget']
        total_spent = stats['total_spent']
        if total_budget > 0:
            spent_percent = (total_spent / total_budget * 100) if total_budget > 0 else 0
            summary_parts.append(
                f"Бюджет: {total_budget:.2f} (израсходовано: {total_spent:.2f}, {spent_percent:.0f}%)."
            )
        
        # Риски
        risk_projects = stats['risk_projects_count']
        if risk_projects > 0:
            summary_parts.append(
                f"⚠️ РИСК: {risk_projects} проект(ов) с превышением бюджета (>80%)."
            )
        
        # Задачи
        open_tasks = stats['open_tasks_count']
        overdue_tasks = stats['overdue_tasks_count']
        if open_tasks > 0:
            summary_parts.append(
                f"Открытых задач: {open_tasks}"
                f"{f' (просрочено: {overdue_tasks})' if overdue_tasks > 0 else ''}."
            )
        
        return " ".join(summary_parts)
