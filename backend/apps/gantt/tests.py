from datetime import date

from django.test import TestCase

from apps.core.models import User, Workspace
from apps.gantt.models import GanttTask
from apps.gantt.serializers import TaskDependencySerializer
from apps.gantt.services import recalculate_dates
from apps.todo.models import Project, TaskDependency, WorkItem


class GanttAutoSchedulingTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='gantt_user',
            email='gantt@example.com',
            password='strongpass123',
        )
        self.workspace = Workspace.objects.create(name='WS Gantt', slug='ws-gantt')
        self.project = Project.objects.create(
            name='Project Gantt',
            workspace=self.workspace,
            owner=self.user,
            status=Project.STATUS_ACTIVE,
        )

    def _create_task(self, title: str, start: date, due: date) -> WorkItem:
        return WorkItem.objects.create(
            title=title,
            project=self.project,
            created_by=self.user,
            status=WorkItem.STATUS_TODO,
            start_date=start,
            due_date=due,
            progress=0,
        )

    def test_fs_cascade_moves_successor_both_directions(self):
        predecessor = self._create_task('A', date(2026, 1, 1), date(2026, 1, 5))
        successor = self._create_task('B', date(2026, 1, 10), date(2026, 1, 12))
        TaskDependency.objects.create(predecessor=predecessor, successor=successor, type=TaskDependency.TYPE_FS)

        recalculate_dates(predecessor)
        successor.refresh_from_db()
        self.assertEqual(successor.start_date, date(2026, 1, 5))
        self.assertEqual(successor.due_date, date(2026, 1, 7))

        predecessor.due_date = date(2026, 1, 3)
        predecessor._skip_signal = True
        predecessor.save(update_fields=['due_date', 'updated_at'])
        recalculate_dates(predecessor)
        successor.refresh_from_db()
        self.assertEqual(successor.start_date, date(2026, 1, 3))
        self.assertEqual(successor.due_date, date(2026, 1, 5))

    def test_ss_and_ff_constraints_are_applied(self):
        predecessor = self._create_task('P', date(2026, 2, 1), date(2026, 2, 10))
        succ_ss = self._create_task('SS', date(2026, 2, 20), date(2026, 2, 25))
        succ_ff = self._create_task('FF', date(2026, 2, 15), date(2026, 2, 20))

        TaskDependency.objects.create(
            predecessor=predecessor,
            successor=succ_ss,
            type=TaskDependency.TYPE_SS,
            lag_days=2,
        )
        TaskDependency.objects.create(
            predecessor=predecessor,
            successor=succ_ff,
            type=TaskDependency.TYPE_FF,
            lag_days=1,
        )

        recalculate_dates(predecessor)
        succ_ss.refresh_from_db()
        succ_ff.refresh_from_db()

        self.assertEqual(succ_ss.start_date, date(2026, 2, 3))  # 1 + 2 дня
        self.assertEqual(succ_ss.due_date, date(2026, 2, 8))    # длительность сохранена

        self.assertEqual(succ_ff.due_date, date(2026, 2, 11))   # 10 + 1 день
        self.assertEqual(succ_ff.start_date, date(2026, 2, 6))  # длительность сохранена

    def test_serializer_create_recalculates_immediately(self):
        predecessor = self._create_task('Pre', date(2026, 3, 1), date(2026, 3, 4))
        successor = self._create_task('Suc', date(2026, 3, 20), date(2026, 3, 23))

        pred_gt = GanttTask.objects.get(related_workitem=predecessor)
        succ_gt = GanttTask.objects.get(related_workitem=successor)

        serializer = TaskDependencySerializer(
            data={
                'predecessor': pred_gt.id,
                'successor': succ_gt.id,
                'type': 'FS',
                'lag_days': 0,
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        successor.refresh_from_db()
        self.assertEqual(successor.start_date, date(2026, 3, 4))
        self.assertEqual(successor.due_date, date(2026, 3, 7))
