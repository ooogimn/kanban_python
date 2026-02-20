"""
Management command для проверки дедлайнов и перерасхода времени (Task 1.2).

Использование:
    python manage.py run_alerts

Запускается по расписанию через системный cron, например:
    */15 * * * * cd /path/to/project && python manage.py run_alerts >> /var/log/alerts.log 2>&1
"""
import logging

from django.core.management.base import BaseCommand
from apps.todo.services import alert_service

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Проверка дедлайнов и перерасхода времени, отправка уведомлений'
    
    def handle(self, *args, **options):
        """Основная логика команды."""
        self.stdout.write(self.style.SUCCESS('=== Запуск проверки алертов ==='))
        
        total_alerts = 0
        
        # 1. Проверка дедлайнов
        try:
            self.stdout.write('Проверка дедлайнов...')
            deadline_alerts = alert_service.check_deadlines()
            total_alerts += deadline_alerts
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Дедлайны: отправлено уведомлений: {deadline_alerts}'
                )
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'✗ Ошибка при проверке дедлайнов: {e}')
            )
            logger.exception('Error in check_deadlines')
        
        # 2. Проверка перерасхода времени
        try:
            self.stdout.write('Проверка перерасхода времени...')
            time_alerts = alert_service.check_time_estimates()
            total_alerts += time_alerts
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Время: отправлено уведомлений: {time_alerts}'
                )
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'✗ Ошибка при проверке времени: {e}')
            )
            logger.exception('Error in check_time_estimates')
        
        # Итоговая статистика
        self.stdout.write(
            self.style.SUCCESS(
                f'\n=== Проверка завершена. Всего отправлено уведомлений: {total_alerts} ==='
            )
        )
