"""
Tests for kanban app: ProgressService (progress и health для Stage и Project).
"""
from django.test import TestCase

from apps.core.models import User, Workspace, WorkspaceMember
from apps.todo.models import Project, WorkItem
from apps.kanban.models import Stage, Column
from apps.kanban.services import ProgressService


class ProgressServiceTestCase(TestCase):
    """Корректный расчёт progress и health_status для Stage и Project."""

    def setUp(self):
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
        self.stage = Stage.objects.create(
            name='Test Stage',
            project=self.project,
            is_default=True,
        )
        self.col_plan = Column.objects.filter(
            stage=self.stage,
            system_type=Column.SYSTEM_TYPE_PLAN,
        ).first()
        self.col_in_progress = Column.objects.filter(
            stage=self.stage,
            system_type=Column.SYSTEM_TYPE_IN_PROGRESS,
        ).first()
        self.col_done = Column.objects.filter(
            stage=self.stage,
            system_type=Column.SYSTEM_TYPE_DONE,
        ).first()

    def test_recalculate_stage_progress_empty(self):
        """Этап без задач: progress=0, health=on_track."""
        ProgressService.recalculate_stage_progress(self.stage)
        self.stage.refresh_from_db()
        self.assertEqual(self.stage.progress, 0)
        self.assertEqual(self.stage.health_status, Stage.HEALTH_ON_TRACK)

    def test_recalculate_stage_progress_with_tasks(self):
        """Этап с задачами в done: progress считается по формуле."""
        if not self.col_plan or not self.col_done:
            self.skipTest('Колонки не созданы сигналом')
        task1 = WorkItem.objects.create(
            title='Task 1',
            project=self.project,
            stage=self.stage,
            kanban_column=self.col_done,
            status=WorkItem.STATUS_COMPLETED,
        )
        task2 = WorkItem.objects.create(
            title='Task 2',
            project=self.project,
            stage=self.stage,
            kanban_column=self.col_plan,
            status=WorkItem.STATUS_TODO,
        )
        ProgressService.recalculate_stage_progress(self.stage)
        self.stage.refresh_from_db()
        self.assertEqual(self.stage.progress, 50)
        self.assertEqual(self.stage.health_status, Stage.HEALTH_ON_TRACK)

    def test_recalculate_project_progress_empty(self):
        """Проект без этапов: progress=0, health=on_track."""
        ProgressService.recalculate_project_progress(self.project)
        self.project.refresh_from_db()
        self.assertEqual(self.project.progress, 0)
        self.assertEqual(self.project.health_status, 'on_track')

    def test_recalculate_project_progress_from_stages(self):
        """Проект: progress — среднее по этапам, health=behind если этап behind."""
        self.stage.progress = 60
        self.stage.health_status = Stage.HEALTH_ON_TRACK
        self.stage.save()
        stage2 = Stage.objects.create(
            name='Stage 2',
            project=self.project,
            is_default=False,
        )
        stage2.progress = 40
        stage2.health_status = Stage.HEALTH_ON_TRACK
        stage2.save()
        ProgressService.recalculate_project_progress(self.project)
        self.project.refresh_from_db()
        self.assertEqual(self.project.progress, 50)
        self.assertEqual(self.project.health_status, 'on_track')
        stage2.health_status = Stage.HEALTH_BEHIND
        stage2.save()
        ProgressService.recalculate_project_progress(self.project)
        self.project.refresh_from_db()
        self.assertEqual(self.project.health_status, 'behind')
