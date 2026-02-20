"""
Service для отправки WebSocket сообщений и уведомлений.
"""
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json

channel_layer = get_channel_layer()


class TelegramNotificationService:
    """Сервис отправки уведомлений в Telegram (через бота)."""

    @staticmethod
    def send_message(user_id: int, text: str) -> bool:
        """
        Отправить сообщение пользователю в Telegram.
        :param user_id: ID пользователя в системе (User.id); у пользователя должен быть telegram_id.
        :param text: Текст сообщения (поддерживается HTML).
        :return: True если отправлено успешно.
        """
        try:
            from apps.bot.services import send_telegram_message
            return send_telegram_message(user_id, text)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning('TelegramNotificationService.send_message: %s', e)
            return False


class NotificationService:
    """Сервис для отправки уведомлений через WebSocket."""
    
    @staticmethod
    def send_dashboard_update(user_id, data):
        """Отправка обновления дашборда пользователю."""
        group_name = f"dashboard_{user_id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'dashboard_update',
                'data': data
            }
        )
    
    @staticmethod
    def send_task_update(user_id, task_data):
        """Отправка обновления задачи пользователю."""
        group_name = f"dashboard_{user_id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'task_update',
                'data': task_data
            }
        )
    
    @staticmethod
    def send_kanban_update(board_id, data):
        """Отправка обновления канбан-доски."""
        group_name = f"kanban_board_{board_id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'kanban_update',
                'data': data
            }
        )
    
    @staticmethod
    def send_card_moved(board_id, card_data):
        """Отправка информации о перемещении карточки."""
        group_name = f"kanban_board_{board_id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'card_moved',
                'data': card_data
            }
        )
    
    @staticmethod
    def send_card_created(board_id, card_data):
        """Отправка информации о создании карточки."""
        group_name = f"kanban_board_{board_id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'card_created',
                'data': card_data
            }
        )
    
    @staticmethod
    def send_project_update(project_id, data):
        """Отправка обновления проекта."""
        group_name = f"project_{project_id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'project_update',
                'data': data
            }
        )
    
    @staticmethod
    def send_task_created(project_id, task_data):
        """Отправка информации о создании задачи."""
        group_name = f"project_{project_id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'task_created',
                'data': task_data
            }
        )
    
    @staticmethod
    def send_task_updated(project_id, task_data):
        """Отправка информации об обновлении задачи."""
        group_name = f"project_{project_id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'task_updated',
                'data': task_data
            }
        )
    
    @staticmethod
    def send_task_deleted(project_id, task_id):
        """Отправка информации об удалении задачи."""
        group_name = f"project_{project_id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'task_deleted',
                'data': {'task_id': task_id}
            }
        )
