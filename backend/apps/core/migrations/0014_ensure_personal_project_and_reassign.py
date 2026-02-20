# Личное пространство/проект: создать недостающие личные проекты у старых пользователей,
# переназначить WikiPage и WorkItem без привязки в личное пространство/проект.

from django.db import migrations


PERSONAL_PROJECT_NAME = 'Личный проект'


def ensure_personal_projects_and_reassign(apps, schema_editor):
    User = apps.get_model('core', 'User')
    Workspace = apps.get_model('core', 'Workspace')
    WorkspaceMember = apps.get_model('core', 'WorkspaceMember')
    ProjectMember = apps.get_model('core', 'ProjectMember')
    Project = apps.get_model('todo', 'Project')
    WikiPage = apps.get_model('documents', 'WikiPage')
    WorkItem = apps.get_model('todo', 'WorkItem')

    for user in User.objects.filter(is_active=True):
        personal_ws = Workspace.objects.filter(owner_id=user.id, is_personal=True).first()
        if not personal_ws:
            continue
        personal_proj = Project.objects.filter(workspace=personal_ws, is_personal=True).first()
        if not personal_proj:
            personal_proj = Project.objects.create(
                name=PERSONAL_PROJECT_NAME,
                workspace=personal_ws,
                owner=user,
                is_personal=True,
                status='active',
            )
            display_name = (user.first_name or '').strip() or (user.last_name or '').strip() or user.username or user.email or str(user)
            ProjectMember.objects.get_or_create(
                project=personal_proj,
                user=user,
                defaults={'display_name': display_name or 'Участник', 'role': 'Owner'},
            )
        WikiPage.objects.filter(
            author=user,
            workspace__isnull=True,
            project__isnull=True,
        ).update(workspace_id=personal_ws.id, project_id=personal_proj.id)
        WorkItem.objects.filter(
            created_by=user,
            project__isnull=True,
        ).update(project_id=personal_proj.id)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0013_user_hide_ads_userevent'),
        ('todo', '0018_project_is_personal'),
        ('documents', '0007_wikipage_color'),
    ]

    operations = [
        migrations.RunPython(ensure_personal_projects_and_reassign, noop),
    ]
