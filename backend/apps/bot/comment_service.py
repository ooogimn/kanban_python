"""
Создание комментариев от имени пользователя Telegram.
"""
from typing import Tuple

from django.contrib.contenttypes.models import ContentType

from apps.documents.models import Comment
from apps.todo.models import WorkItem, Project
from apps.documents.models import Attachment


ENTITY_MODEL_MAP = {
    'workitem': WorkItem,
    'task': WorkItem,
    'project': Project,
    'attachment': Attachment,
    'file': Attachment,
}


def create_comment_from_telegram(
    telegram_id: int,
    entity_type: str,
    entity_id: int,
    text: str,
    parent_id: int = None,
) -> Tuple[bool, str]:
    """
    Создать комментарий от имени пользователя по telegram_id.

    :return: (success, error_message)
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()

    try:
        user = User.objects.get(telegram_id=telegram_id)
    except User.DoesNotExist:
        return False, "Аккаунт не связан с Telegram."

    entity_type_lower = entity_type.lower()
    if entity_type_lower not in ENTITY_MODEL_MAP:
        return False, f"Неизвестный тип сущности: {entity_type}"

    model_class = ENTITY_MODEL_MAP[entity_type_lower]
    content_type = ContentType.objects.get_for_model(model_class)

    try:
        obj = model_class.objects.get(pk=entity_id)
    except model_class.DoesNotExist:
        return False, "Сущность не найдена."

    parent = None
    if parent_id:
        try:
            parent = Comment.objects.get(pk=parent_id)
        except Comment.DoesNotExist:
            pass

    workitem = obj if isinstance(obj, WorkItem) else None

    Comment.objects.create(
        content=text,
        author=user,
        content_type=content_type,
        object_id=entity_id,
        workitem=workitem,
        parent=parent,
    )
    return True, ""
