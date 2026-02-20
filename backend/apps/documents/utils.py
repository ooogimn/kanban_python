"""
Утилиты для работы с файлами и документами.
"""
import mimetypes
from typing import Optional
from django.contrib.contenttypes.models import ContentType


# MIME типы для разных категорий файлов
EXCEL_MIME_TYPES = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
]

WORD_MIME_TYPES = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-word.document.macroEnabled.12',
]

PDF_MIME_TYPES = [
    'application/pdf',
]

IMAGE_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
]

VIDEO_MIME_TYPES = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
]

AUDIO_MIME_TYPES = [
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/webm',
]

ARCHIVE_MIME_TYPES = [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-tar',
    'application/gzip',
]


def get_file_type(mime_type: str) -> str:
    """
    Определяет тип файла по MIME типу.
    
    Возвращает: document, image, video, audio, archive, other
    """
    if mime_type in EXCEL_MIME_TYPES + WORD_MIME_TYPES + PDF_MIME_TYPES:
        return 'document'
    elif mime_type in IMAGE_MIME_TYPES:
        return 'image'
    elif mime_type in VIDEO_MIME_TYPES:
        return 'video'
    elif mime_type in AUDIO_MIME_TYPES:
        return 'audio'
    elif mime_type in ARCHIVE_MIME_TYPES:
        return 'archive'
    else:
        return 'other'


def can_preview_in_browser(mime_type: str) -> bool:
    """
    Проверяет, можно ли просматривать файл в браузере.
    """
    return mime_type in (
        PDF_MIME_TYPES + 
        IMAGE_MIME_TYPES + 
        VIDEO_MIME_TYPES + 
        AUDIO_MIME_TYPES +
        EXCEL_MIME_TYPES +
        WORD_MIME_TYPES
    )


def get_upload_path(instance, filename: str) -> str:
    """
    Генерирует путь для сохранения файла.
    
    Структура: projects/{project_id}/files/{entity_type}/{entity_id}/{filename}
    """
    # Получаем project_id
    if hasattr(instance, 'project') and instance.project:
        project_id = instance.project.id
    elif hasattr(instance, 'workitem') and instance.workitem and instance.workitem.project:
        project_id = instance.workitem.project.id
    else:
        project_id = 'general'
    
    # Получаем entity_type и entity_id
    if hasattr(instance, 'content_type') and instance.content_type:
        entity_type = instance.content_type.model
        entity_id = instance.object_id
    elif hasattr(instance, 'workitem') and instance.workitem:
        entity_type = 'workitem'
        entity_id = instance.workitem.id
    else:
        entity_type = 'unknown'
        entity_id = 0
    
    return f'projects/{project_id}/files/{entity_type}/{entity_id}/{filename}'


def get_google_docs_preview_url(file_url: str, mime_type: str) -> Optional[str]:
    """
    Генерирует URL для просмотра файла через Google Docs/Sheets viewer.
    
    Args:
        file_url: Публичный URL файла
        mime_type: MIME тип файла
    
    Returns:
        URL для Google Docs/Sheets viewer или None
    """
    from urllib.parse import quote
    
    if mime_type in EXCEL_MIME_TYPES:
        # Google Sheets viewer
        encoded_url = quote(file_url, safe='')
        return f"https://docs.google.com/spreadsheets/d/1/edit?usp=sharing&url={encoded_url}"
    elif mime_type in WORD_MIME_TYPES:
        # Google Docs viewer
        encoded_url = quote(file_url, safe='')
        return f"https://docs.google.com/document/d/1/edit?usp=sharing&url={encoded_url}"
    
    return None


def get_google_viewer_url(file_url: str, mime_type: str) -> Optional[str]:
    """
    Генерирует URL для Google Docs Viewer (универсальный просмотрщик).
    
    Args:
        file_url: Публичный URL файла
        mime_type: MIME тип файла
    
    Returns:
        URL для Google Docs Viewer или None
    """
    from urllib.parse import quote
    
    if mime_type in (EXCEL_MIME_TYPES + WORD_MIME_TYPES + PDF_MIME_TYPES):
        encoded_url = quote(file_url, safe='')
        return f"https://docs.google.com/viewer?url={encoded_url}&embedded=true"
    
    return None
