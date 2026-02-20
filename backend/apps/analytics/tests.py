"""
Tests for analytics app (export CSV).
"""
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.models import User, Workspace, WorkspaceMember
from apps.todo.models import Project


class AnalyticsExportTestCase(TestCase):
    """Export tasks/projects CSV."""

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
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_export_tasks_csv_returns_csv_with_headers(self):
        """GET /api/v1/analytics/export/tasks/?workspace_id=X returns CSV with header row."""
        response = self.client.get(
            f'/api/v1/analytics/export/tasks/',
            {'workspace_id': self.workspace.id},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', response.get('Content-Type', ''))
        content = response.content.decode('utf-8-sig')
        self.assertIn('ID', content)
        self.assertIn('Название', content)
        self.assertIn('Статус', content)

    def test_export_tasks_csv_requires_workspace_or_project(self):
        """Export tasks without workspace_id or project_id returns 400."""
        response = self.client.get('/api/v1/analytics/export/tasks/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_export_projects_csv_returns_csv(self):
        """GET /api/v1/analytics/export/projects/?workspace_id=X returns CSV."""
        response = self.client.get(
            '/api/v1/analytics/export/projects/',
            {'workspace_id': self.workspace.id},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', response.get('Content-Type', ''))
