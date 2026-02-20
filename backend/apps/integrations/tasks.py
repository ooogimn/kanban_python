"""
Celery-задачи для интеграций (Google Sheets и др.).
"""
import logging

from celery import shared_task
from django.core.cache import cache

logger = logging.getLogger(__name__)

# Не чаще 1 раза в минуту на проект (при любом изменении — экспорт ставится в очередь)
GOOGLE_SHEETS_EXPORT_DEBOUNCE_SEC = 60


def trigger_export_on_change(project_id: int) -> None:
    """
    Экспорт в Google Sheets при любом изменении (задача, карточка и т.д.).
    Не чаще 1 раза в минуту на проект: повторные изменения в течение 60 сек
    не добавляют новый экспорт (debounce через кэш).
    """
    from .services.google_sheets import get_sheet_id_for_project

    sheet_id = get_sheet_id_for_project(project_id)
    if not sheet_id:
        return
    cache_key = f"gs_export_pending_{project_id}"
    if not cache.add(cache_key, 1, timeout=GOOGLE_SHEETS_EXPORT_DEBOUNCE_SEC + 10):
        return
    export_tasks_to_google_sheet.apply_async(
        args=[project_id, sheet_id],
        countdown=GOOGLE_SHEETS_EXPORT_DEBOUNCE_SEC,
    )


@shared_task
def export_tasks_to_google_sheet(project_id: int, sheet_id: str):
    """
    Асинхронный экспорт задач проекта в Google Sheets.
    """
    from .services.google_sheets import export_project_tasks_to_sheet

    result = export_project_tasks_to_sheet(project_id, sheet_id)
    if not result.get('ok'):
        logger.warning('export_tasks_to_google_sheet failed: %s', result.get('error'))
    return result


@shared_task
def run_scheduled_google_sheets_exports():
    """
    Периодическая задача (Celery Beat) для экспорта задач в Google Sheets
    по расписанию. Читает список проектов из GOOGLE_SHEETS_SCHEDULED_EXPORTS
    и запускает экспорт для каждого.
    """
    from django.conf import settings
    from .services.google_sheets import export_project_tasks_to_sheet

    scheduled_exports = getattr(settings, 'GOOGLE_SHEETS_SCHEDULED_EXPORTS', [])
    if not scheduled_exports:
        logger.debug('No scheduled Google Sheets exports configured')
        return {'ok': True, 'message': 'No exports configured', 'count': 0}

    success_count = 0
    error_count = 0
    errors = []

    for export_config in scheduled_exports:
        project_id = export_config.get('project_id')
        sheet_id = export_config.get('sheet_id')

        if not project_id or not sheet_id:
            logger.warning('Invalid export config: %s', export_config)
            error_count += 1
            errors.append(f'Invalid config: {export_config}')
            continue

        try:
            result = export_project_tasks_to_sheet(project_id, sheet_id)
            if result.get('ok'):
                success_count += 1
                logger.info(
                    'Scheduled export successful: project_id=%s, sheet_id=%s, rows=%s',
                    project_id, sheet_id, result.get('rows', 0)
                )
            else:
                error_count += 1
                error_msg = result.get('error', 'Unknown error')
                errors.append(f'Project {project_id}: {error_msg}')
                logger.warning(
                    'Scheduled export failed: project_id=%s, sheet_id=%s, error=%s',
                    project_id, sheet_id, error_msg
                )
        except Exception as e:
            error_count += 1
            error_msg = str(e)
            errors.append(f'Project {project_id}: {error_msg}')
            logger.exception('Scheduled export exception: project_id=%s, sheet_id=%s', project_id, sheet_id)

    return {
        'ok': error_count == 0,
        'success_count': success_count,
        'error_count': error_count,
        'errors': errors if errors else None,
    }
