"""
AI-SPRINT 1: API контекста проекта для AI.
"""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import WorkspaceMember
from apps.todo.models import Project
from .services.context import ProjectContextService


class ProjectAnalyzeView(APIView):
    """
    POST /api/v1/ai/analyze/ с телом { "project_id": <id> }.
    Возвращает context (dict) и summary (строка).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        project_id = request.data.get('project_id')
        if project_id is None:
            return Response(
                {'detail': 'Обязательное поле: project_id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            project_id = int(project_id)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'project_id должен быть числом.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = Project.objects.filter(id=project_id).select_related('workspace').first()
        if not project:
            return Response(
                {'detail': 'Проект не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not WorkspaceMember.objects.filter(
            workspace_id=project.workspace_id,
            user=request.user,
        ).exists() and not getattr(request.user, 'is_staff', False):
            return Response(
                {'detail': 'Нет доступа к проекту.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        ctx = ProjectContextService.get_project_summary(project_id, request.user)
        if not ctx:
            return Response(
                {'detail': 'Не удалось собрать контекст.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Текстовая сводка (заглушка для будущего LLM)
        meta = ctx['meta']
        tasks = ctx['tasks_stats']
        team_count = len(ctx['team'])
        parts = [
            f"Проект «{meta['name']}» в статусе {meta['health_status']}.",
            f"Горящих задач: {tasks['hot_count']}, просроченных: {tasks['overdue_count']}.",
            f"Участников: {team_count}.",
        ]
        if ctx.get('finance'):
            fin = ctx['finance']
            parts.append(f"Бюджет: остаток {fin['available']} (статус: {fin['status']}).")
        summary = ' '.join(parts)

        return Response(
            {'context': ctx, 'summary': summary},
            status=status.HTTP_200_OK,
        )
