"""
API для интеграций (Google Sheets и др.).
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from apps.todo.models import Project
from apps.core.models import WorkspaceMember

from .services.google_sheets import export_project_tasks_to_sheet


def _user_has_project_access(user, project: Project) -> bool:
    """Проверка: пользователь — участник workspace проекта."""
    if not user or not user.is_authenticated or not project.workspace_id:
        return False
    return WorkspaceMember.objects.filter(
        workspace_id=project.workspace_id,
        user=user,
    ).exists()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def google_sheets_export(request: Request):
    """
    Экспорт задач проекта в Google Sheets.

    POST /api/v1/integrations/google-sheets/export/
    Body: { "project_id": 1, "sheet_id": "1abc...", "async": false }
    - project_id: обязателен
    - sheet_id: ID таблицы (из URL /d/{sheet_id}/edit)
    - async: если true — запуск через Celery, иначе синхронно
    """
    data = request.data or {}
    project_id = data.get('project_id')
    sheet_id = data.get('sheet_id')
    use_async = data.get('async', False)

    if not project_id:
        return Response(
            {'error': 'project_id required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    if not sheet_id:
        return Response(
            {'error': 'sheet_id required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        project_id = int(project_id)
    except (TypeError, ValueError):
        return Response(
            {'error': 'project_id must be an integer'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response(
            {'error': 'Project not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if not _user_has_project_access(request.user, project):
        return Response(
            {'error': 'No access to this project'},
            status=status.HTTP_403_FORBIDDEN
        )

    if use_async:
        try:
            from .tasks import export_tasks_to_google_sheet
            t = export_tasks_to_google_sheet.delay(project_id, str(sheet_id))
            return Response({
                'status': 'queued',
                'task_id': str(t.id),
                'message': 'Export started. Check Celery logs for result.',
            }, status=status.HTTP_202_ACCEPTED)
        except Exception as e:
            return Response(
                {'error': f'Failed to queue task: {e}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

    result = export_project_tasks_to_sheet(project_id, str(sheet_id))
    if result.get('ok'):
        return Response(result, status=status.HTTP_200_OK)
    return Response(
        {'error': result.get('error', 'Export failed')},
        status=status.HTTP_502_BAD_GATEWAY
    )
