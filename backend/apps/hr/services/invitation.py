"""
HR services — приглашения (HR-SPRINT 3).
"""
from django.utils import timezone
from datetime import timedelta

from apps.core.models import WorkspaceMember


def create_invitation(contact, sender):
    """
    Создать приглашение для теневого контакта.
    Проверка: contact.user is None, contact.email задан.
    Возвращает Invitation или raises ValueError.
    """
    from ..models import Contact, Invitation

    if contact.user_id is not None:
        raise ValueError('Приглашение можно отправить только теневому контакту (без привязки к пользователю).')
    if not (contact.email and contact.email.strip()):
        raise ValueError('У контакта должен быть указан email для приглашения.')

    existing = Invitation.objects.filter(contact=contact, status=Invitation.STATUS_PENDING).first()
    if existing and existing.expires_at > timezone.now():
        return existing

    expires_at = timezone.now() + timedelta(hours=48)
    inv = Invitation.objects.create(
        workspace=contact.workspace,
        sender=sender,
        email=contact.email.strip(),
        contact=contact,
        status=Invitation.STATUS_PENDING,
        expires_at=expires_at,
    )
    return inv


def process_acceptance(user, token):
    """
    Обработать принятие приглашения по токену.
    """
    from ..models import Invitation

    try:
        inv = Invitation.objects.select_related('contact', 'workspace').get(token=token)
    except Invitation.DoesNotExist:
        raise ValueError('Приглашение не найдено.')

    if inv.status != Invitation.STATUS_PENDING:
        raise ValueError('Приглашение уже использовано или отменено.')

    if timezone.now() > inv.expires_at:
        inv.status = Invitation.STATUS_EXPIRED
        inv.save(update_fields=['status'])
        raise ValueError('Срок действия приглашения истёк.')

    contact = inv.contact
    workspace = inv.workspace

    contact.user = user
    contact.save(update_fields=['user'])

    inv.status = Invitation.STATUS_ACCEPTED
    inv.save(update_fields=['status'])

    if not WorkspaceMember.objects.filter(workspace=workspace, user=user).exists():
        WorkspaceMember.objects.create(
            workspace=workspace,
            user=user,
            role=WorkspaceMember.ROLE_MEMBER,
        )

    from apps.core.models import ProjectMember
    ProjectMember.objects.filter(contact=contact, user__isnull=True).update(user=user)

    return contact, workspace
