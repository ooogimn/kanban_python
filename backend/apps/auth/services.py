"""
Сервисы для аутентификации.
"""
import logging
import random
import requests
import os
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)


class TelegramService:
    """Сервис для работы с Telegram Bot API."""
    
    def __init__(self):
        self.bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None) or os.environ.get('TELEGRAM_BOT_TOKEN')
        self.api_url = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else None
    
    def send_message(self, chat_id: str, text: str) -> bool:
        """
        Отправка сообщения в Telegram.
        
        :param chat_id: Telegram ID пользователя или username (с @)
        :param text: Текст сообщения
        :return: True если успешно, False иначе
        """
        if not self.api_url:
            logger.error('TELEGRAM_BOT_TOKEN not set')
            return False
        
        try:
            # Если это username (начинается с @), используем его напрямую
            # Если это номер телефона или ID, нужно сначала получить chat_id
            if chat_id.startswith('@'):
                # Для каналов/групп
                url = f"{self.api_url}/sendMessage"
            else:
                # Пытаемся определить, это ID или username
                # Если это число - это ID, иначе username
                try:
                    chat_id_int = int(chat_id)
                    url = f"{self.api_url}/sendMessage"
                except ValueError:
                    # Это username без @, добавляем @
                    if not chat_id.startswith('@'):
                        chat_id = f"@{chat_id}"
                    url = f"{self.api_url}/sendMessage"
            
            response = requests.post(
                url,
                json={
                    'chat_id': chat_id,
                    'text': text,
                    'parse_mode': 'HTML'
                },
                timeout=10
            )
            
            if response.status_code == 200:
                return True
            else:
                logger.error(f'Telegram API error: {response.status_code} - {response.text}')
                return False
                
        except Exception as e:
            logger.exception(f'Error sending Telegram message: {e}')
            return False
    
    def send_verification_code(self, telegram_contact: str, code: str) -> bool:
        """
        Отправка кода подтверждения в Telegram.
        
        :param telegram_contact: Telegram username (с @ или без) или номер телефона
        :param code: Код подтверждения
        :return: True если успешно, False иначе
        """
        message = (
            f"🔐 <b>Код подтверждения для Office Suite 360</b>\n\n"
            f"Ваш код подтверждения: <code>{code}</code>\n\n"
            f"Код действителен в течение 10 минут.\n"
            f"Если вы не запрашивали этот код, проигнорируйте это сообщение."
        )
        
        # Нормализуем telegram_contact
        if not telegram_contact.startswith('@'):
            # Если это не номер телефона (начинается с +), то это username
            if not telegram_contact.startswith('+'):
                telegram_contact = f"@{telegram_contact}"
        
        return self.send_message(telegram_contact, message)


def generate_verification_code() -> str:
    """Генерация 6-значного кода подтверждения."""
    return str(random.randint(100000, 999999))


def get_verification_code_expiry() -> timezone.datetime:
    """Получение времени истечения кода (10 минут)."""
    return timezone.now() + timedelta(minutes=10)


def send_email_code(email: str, code: str) -> bool:
    """
    Отправка кода подтверждения на email.
    В будущем можно интегрировать с Django email backend.
    """
    # TODO: Интеграция с email сервисом (Django email backend, SendGrid, etc.)
    # Пока просто логируем
    logger.info(f'Verification code for {email}: {code}')
    # В реальном приложении здесь будет отправка email
    return True
