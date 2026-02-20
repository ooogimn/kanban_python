"""
API views for core app (dashboard stats, project members).
"""
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Q, Value, DecimalField
from django.db.models.functions import TruncMonth, Coalesce
from django.utils import timezone
from datetime import timedelta
from calendar import month_abbr

from apps.auth.permissions import IsWorkspaceMember, IsManagerOrReadOnly
from apps.finance.models import Transaction
from apps.timetracking.models import TimeLog
from apps.core.models import WorkspaceMember, ProjectMember, Workspace
from apps.core.serializers import ProjectMemberSerializer
from apps.todo.models import Project


class ProjectMemberViewSet(viewsets.ModelViewSet):
    """
    CRUD участников проекта (в т.ч. теневых).
    Обязательный фильтр: ?project_id=X. Без project_id — 400.
    Чтение — всем членам workspace проекта; запись — Director/Manager.
    """
    serializer_class = ProjectMemberSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceMember, IsManagerOrReadOnly]

    def get_queryset(self):
        project_id = self.request.query_params.get('project_id')
        if not project_id:
            return ProjectMember.objects.none()
        try:
            project_id = int(project_id)
        except (ValueError, TypeError):
            return ProjectMember.objects.none()
        user = self.request.user
        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        )
        if not workspace_ids and getattr(user, 'is_staff', False):
            workspace_ids = list(Workspace.objects.values_list('id', flat=True))
        if not workspace_ids:
            return ProjectMember.objects.none()
        return ProjectMember.objects.filter(
            project_id=project_id,
            project__workspace_id__in=workspace_ids,
        ).select_related('project', 'user', 'contact').order_by('display_name')

    def list(self, request, *args, **kwargs):
        if not request.query_params.get('project_id'):
            return Response(
                {'detail': 'Обязательный параметр: project_id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        """Проверка: проект должен быть в workspace пользователя."""
        project = serializer.validated_data.get('project')
        user = self.request.user
        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        )
        if not workspace_ids and getattr(user, 'is_staff', False):
            workspace_ids = list(Workspace.objects.values_list('id', flat=True))
        if project and workspace_ids and project.workspace_id not in workspace_ids:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                'Недостаточно прав: проект не в вашем рабочем пространстве.'
            )
        serializer.save()


class DashboardStatsView(APIView):
    """
    GET /api/v1/core/dashboard-stats/
    Агрегация для графиков дашборда: finance_flow, project_hours, team_load.
    Если данных мало — возвращаются моковые значения для демонстрации.
    """
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get(self, request):
        user = request.user
        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        )
        if not workspace_ids and getattr(user, 'is_staff', False):
            workspace_ids = list(Workspace.objects.values_list('id', flat=True))
        user_projects = Project.objects.filter(workspace_id__in=workspace_ids)
        project_ids = list(user_projects.values_list('id', flat=True))

        # --- finance_flow: по месяцам (income = deposit, expense = spend) ---
        finance_flow = []
        if project_ids:
            zero = Value(0, output_field=DecimalField(max_digits=12, decimal_places=2))
            qs = (
                Transaction.objects.filter(project_id__in=project_ids)
                .annotate(month=TruncMonth('created_at'))
                .values('month')
                .annotate(
                    income=Coalesce(Sum('amount', filter=Q(type=Transaction.TYPE_DEPOSIT)), zero),
                    expense=Coalesce(Sum('amount', filter=Q(type=Transaction.TYPE_SPEND)), zero),
                )
                .order_by('month')[:12]
            )
            for row in qs:
                month_date = row['month']
                finance_flow.append({
                    'month': month_abbr[month_date.month] if month_date else '',
                    'income': float(row['income'] or 0),
                    'expense': float(row['expense'] or 0),
                })

        if not finance_flow:
            # Мок: последние 6 месяцев
            now = timezone.now()
            for i in range(5, -1, -1):
                d = now - timedelta(days=30 * i)
                finance_flow.append({
                    'month': month_abbr[d.month],
                    'income': 5000 + i * 500,
                    'expense': 2000 + i * 300,
                })

        # --- project_hours: по проектам (из TimeLog через workitem -> project) ---
        project_hours = []
        if project_ids:
            tl_qs = TimeLog.objects.filter(
                workitem__project_id__in=project_ids,
                duration_minutes__isnull=False,
            ).values('workitem__project__name').annotate(
                total_minutes=Sum('duration_minutes')
            ).order_by('-total_minutes')[:10]

            for row in tl_qs:
                name = row.get('workitem__project__name') or 'Без проекта'
                mins = row.get('total_minutes') or 0
                project_hours.append({'name': name, 'hours': round(mins / 60, 1)})

        if not project_hours:
            project_hours = [
                {'name': 'Project A', 'hours': 120},
                {'name': 'Project B', 'hours': 80},
                {'name': 'Project C', 'hours': 45},
            ]

        # --- team_load: по пользователям (часы как value, можно нормализовать в %) ---
        team_load = []
        tl_user_qs = TimeLog.objects.filter(
            workitem__project_id__in=project_ids,
            duration_minutes__isnull=False,
        ).values('user__username', 'user__first_name').annotate(
            total_minutes=Sum('duration_minutes')
        ).order_by('-total_minutes')[:10]

        total_minutes = sum(row.get('total_minutes') or 0 for row in tl_user_qs)
        for row in tl_user_qs:
            display = (row.get('user__first_name') or row.get('user__username') or 'User').strip()
            if not display:
                display = row.get('user__username') or 'User'
            mins = row.get('total_minutes') or 0
            value = round(mins / 60, 1) if total_minutes else 0
            team_load.append({'name': display, 'value': value})

        if not team_load:
            team_load = [
                {'name': 'Dev 1', 'value': 40},
                {'name': 'Dev 2', 'value': 60},
                {'name': 'PM', 'value': 25},
            ]

        return Response({
            'finance_flow': finance_flow,
            'project_hours': project_hours,
            'team_load': team_load,
        })
