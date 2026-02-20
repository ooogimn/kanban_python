"""
Management command для создания тестовых HR данных (Department + EmployeeProfile).
Запуск: python manage.py seed_hr_test_data [--username USERNAME]

Использует первого superuser (или указанного username), его первый workspace,
и личный кошелёк пользователя для payment_wallet.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from apps.core.models import WorkspaceMember, Workspace
from apps.finance.models import Wallet
from apps.hr.models import Department, EmployeeProfile

User = get_user_model()


class Command(BaseCommand):
    help = 'Создать Department «Администрация» и EmployeeProfile (CEO) для теста HR & Payroll'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            help='Username пользователя (если не указан — первый superuser)',
        )

    def handle(self, *args, **options):
        username = options.get('username')
        if username:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                self.stderr.write(self.style.ERROR(f'Пользователь {username} не найден.'))
                return
        else:
            user = User.objects.filter(is_superuser=True).first()
            if not user:
                self.stderr.write(self.style.ERROR('Нет superuser. Укажите --username или создайте superuser.'))
                return

        # Первый workspace пользователя
        membership = WorkspaceMember.objects.filter(user=user).select_related('workspace').first()
        if not membership:
            self.stderr.write(self.style.ERROR(f'Пользователь {user.username} не состоит ни в одном workspace.'))
            return

        workspace = membership.workspace

        # Личный кошелёк (owner=user)
        wallet = Wallet.objects.filter(owner=user, is_active=True).first()
        if not wallet:
            self.stderr.write(
                self.style.WARNING(
                    'Личный кошелёк не найден. Создайте кошелёк в Финансах (владелец — вы) и запустите команду снова.'
                )
            )

        # Department
        dept, created = Department.objects.get_or_create(
            workspace=workspace,
            name='Администрация',
            defaults={'head': membership, 'is_active': True},
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Создан отдел: {dept.name}'))
        else:
            if not dept.head_id:
                dept.head = membership
                dept.save()
                self.stdout.write(f'Обновлён head отдела: {dept.name}')

        # EmployeeProfile
        emp, emp_created = EmployeeProfile.objects.update_or_create(
            member=membership,
            defaults={
                'department': dept,
                'job_title': 'CEO / Генеральный Директор',
                'status': EmployeeProfile.STATUS_ACTIVE,
                'date_hired': None,
                'employment_type': EmployeeProfile.EMPLOYMENT_FULL_TIME,
                'fte': Decimal('1.0'),
                'salary_mode': EmployeeProfile.SALARY_FIXED,
                'salary_amount': Decimal('1000000'),
                'currency': 'RUB',
                'payment_wallet': wallet,
            },
        )
        if emp_created:
            self.stdout.write(self.style.SUCCESS(f'Создан сотрудник: {emp}'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Обновлён сотрудник: {emp}'))

        if not wallet:
            self.stdout.write(
                self.style.WARNING('payment_wallet не назначен — укажите кошелёк в /admin/ для теста выплаты.')
            )
