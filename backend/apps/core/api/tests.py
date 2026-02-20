"""
Tests for core API: ProjectMemberViewSet, DashboardStatsView.
"""
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.models import User, Workspace, WorkspaceMember, ProjectMember
from apps.todo.models import Project


class ProjectMemberViewSetTestCase(TestCase):
    """CRUD участников проекта и обязательный фильтр project_id."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )
        self.workspace = Workspace.objects.create(
            name='Test Workspace',
            slug='test-ws',
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace,
            user=self.user,
            role=WorkspaceMember.ROLE_MEMBER,
        )
        self.project = Project.objects.create(
            name='Test Project',
            status=Project.STATUS_ACTIVE,
            workspace=self.workspace,
        )
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_list_without_project_id_returns_400(self):
        """GET /api/v1/core/project-members/ без project_id возвращает 400."""
        response = self.client.get('/api/v1/core/project-members/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('project_id', response.json().get('detail', ''))

    def test_list_with_project_id_returns_200(self):
        """GET /api/v1/core/project-members/?project_id=X возвращает 200 и список."""
        response = self.client.get(
            f'/api/v1/core/project-members/?project_id={self.project.id}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.json())

    def test_create_project_member_returns_201_for_manager(self):
        """POST создаёт участника (теневого); запись разрешена Director/Manager."""
        from django.contrib.auth.models import Group
        manager_group, _ = Group.objects.get_or_create(name='Manager')
        self.user.groups.add(manager_group)
        payload = {
            'project': self.project.id,
            'display_name': 'Теневой сотрудник',
            'role': 'Developer',
            'hourly_rate': '1500.00',
        }
        response = self.client.post(
            '/api/v1/core/project-members/',
            payload,
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data['display_name'], 'Теневой сотрудник')
        self.assertTrue(
            ProjectMember.objects.filter(
                project=self.project,
                display_name='Теневой сотрудник',
            ).exists()
        )


class DashboardStatsViewTestCase(TestCase):
    """Дашборд: при наличии workspace возвращает данные, не пустой ответ."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='dashboarduser',
            email='dash@example.com',
            password='testpass123',
        )
        self.workspace = Workspace.objects.create(
            name='Dashboard Workspace',
            slug='dash-ws',
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace,
            user=self.user,
            role=WorkspaceMember.ROLE_MEMBER,
        )
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_dashboard_returns_200_with_workspace(self):
        """GET /api/v1/core/dashboard-stats/ при наличии workspace возвращает 200 и данные."""
        response = self.client.get('/api/v1/core/dashboard-stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('finance_flow', data)
        self.assertIn('project_hours', data)
        self.assertIn('team_load', data)

    def test_dashboard_staff_without_membership_gets_data(self):
        """Staff без членства в workspace всё равно получает данные (fallback)."""
        self.user.is_staff = True
        self.user.save()
        WorkspaceMember.objects.filter(workspace=self.workspace, user=self.user).delete()
        response = self.client.get('/api/v1/core/dashboard-stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('finance_flow', data)
