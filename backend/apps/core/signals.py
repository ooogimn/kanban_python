"""
Сигналы приложения core.
Авто-создание личного пространства (Workspace) и личного проекта (Project) при создании пользователя.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import User, Workspace, WorkspaceMember, ProjectMember


PERSONAL_WORKSPACE_NAME = 'Личное пространство'
PERSONAL_PROJECT_NAME = 'Личный проект'


@receiver(post_save, sender=User)
def create_personal_workspace_for_new_user(sender, instance, created, **kwargs):
    """
    После создания пользователя создаём ему единственное личное пространство
    и один личный проект в нём. Личное пространство не учитывается в лимитах платных пространств.
    """
    if not created:
        return
    if Workspace.objects.filter(owner=instance, is_personal=True).exists():
        return
    slug = f'personal-{instance.pk}'
    if Workspace.objects.filter(slug=slug).exists():
        slug = f'personal-{instance.pk}-{instance.id}'
    workspace = Workspace.objects.create(
        name=PERSONAL_WORKSPACE_NAME,
        slug=slug,
        owner=instance,
        is_personal=True,
    )
    WorkspaceMember.objects.create(
        workspace=workspace,
        user=instance,
        role=WorkspaceMember.ROLE_OWNER,
    )
    # Личный проект в личном пространстве (один на workspace)
    from apps.todo.models import Project
    project = Project.objects.create(
        name=PERSONAL_PROJECT_NAME,
        workspace=workspace,
        owner=instance,
        is_personal=True,
        status=Project.STATUS_ACTIVE,
    )
    display_name = (instance.get_full_name() or instance.username or '').strip() or instance.email or str(instance)
    ProjectMember.objects.create(
        project=project,
        user=instance,
        display_name=display_name or 'Участник',
        role='Owner',
    )
