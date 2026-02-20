"""
Tests for todo app (tasks API).
"""
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.models import User, Workspace, WorkspaceMember
from apps.todo.models import Project, WorkItem


class WorkItemAPITestCase(TestCase):
    """Task (WorkItem) API: create and access."""

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

    def test_create_task_returns_201(self):
        """POST /api/v1/todo/tasks/ with valid data creates task and returns 201."""
        payload = {
            'title': 'Test task',
            'description': 'Description',
            'status': WorkItem.STATUS_TODO,
            'priority': WorkItem.PRIORITY_MEDIUM,
            'project': self.project.id,
        }
        response = self.client.post('/api/v1/todo/tasks/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data.get('title'), 'Test task')
        self.assertEqual(data.get('project'), self.project.id)
        self.assertTrue(WorkItem.objects.filter(id=data['id']).exists())

    def test_list_tasks_requires_auth(self):
        """GET /api/v1/todo/tasks/ without auth returns 401."""
        self.client.credentials()
        response = self.client.get('/api/v1/todo/tasks/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
