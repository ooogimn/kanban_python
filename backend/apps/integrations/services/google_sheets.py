"""
Сервис экспорта задач в Google Sheets.
Использует gspread + service account. Таблицу нужно расшарить на client_email из JSON.
"""
import logging
import os
from typing import List, Optional

from django.conf import settings

logger = logging.getLogger(__name__)


def get_sheet_id_for_project(project_id: int) -> Optional[str]:
    """
    Возвращает sheet_id для проекта, если он в GOOGLE_SHEETS_SCHEDULED_EXPORTS
    (экспорт при изменениях). Иначе None.
    """
    exports = getattr(settings, 'GOOGLE_SHEETS_SCHEDULED_EXPORTS', None) or []
    for item in exports:
        if item.get('project_id') == project_id:
            return item.get('sheet_id')
    return None

def _credentials_path() -> str:
    return (
        getattr(settings, 'GOOGLE_APPLICATION_CREDENTIALS', None)
        or os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', '')
        or ''
    )


def export_project_tasks_to_sheet(project_id: int, sheet_id: str) -> dict:
    """
    Экспортирует задачи проекта в указанную Google-таблицу.

    :param project_id: ID проекта (todo.Project)
    :param sheet_id: ID таблицы (из URL .../d/{sheet_id}/edit) или её название
    :return: {'ok': True, 'rows': N} или {'ok': False, 'error': '...'}
    """
    from apps.todo.models import Project, WorkItem

    path = _credentials_path()
    if not path or not os.path.isfile(path):
        return {'ok': False, 'error': 'GOOGLE_APPLICATION_CREDENTIALS not set or file missing.'}

    try:
        import gspread
    except ImportError:
        return {'ok': False, 'error': 'gspread not installed.'}

    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return {'ok': False, 'error': f'Project {project_id} not found.'}

    tasks = WorkItem.objects.filter(
        project_id=project_id,
        deleted_at__isnull=True
    ).select_related('project').prefetch_related('assigned_to').order_by('due_date', 'id')

    rows: List[List[str]] = [
        ['ID', 'Название', 'Статус', 'Приоритет', 'Дедлайн', 'Исполнители', 'Прогресс %']
    ]
    for t in tasks:
        assignees = ', '.join(u.username or str(u.id) for u in t.assigned_to.all()[:5])
        rows.append([
            str(t.id),
            (t.title or '')[:500],
            t.status or '',
            t.priority or '',
            t.due_date.isoformat() if t.due_date else '',
            assignees,
            str(t.progress or 0),
        ])

    try:
        gc = gspread.service_account(filename=path)
        try:
            sh = gc.open_by_key(sheet_id)
        except Exception:
            sh = gc.open(sheet_id)
        wks = sh.sheet1
        wks.clear()
        if rows:
            wks.update(rows, value_input_option='USER_ENTERED')
        return {'ok': True, 'rows': len(rows) - 1, 'sheet_title': sh.title}
    except Exception as e:
        logger.exception('Google Sheets export failed: %s', e)
        return {'ok': False, 'error': str(e)}
