"""
Serializers for core app.
"""
from rest_framework import serializers
from .models import Workspace, WorkspaceMember, ProjectMember, User
from apps.billing.models import Subscription
from apps.crm.models import Company
from apps.hr.models import Contact
from apps.todo.models import Project


class ProjectMemberSerializer(serializers.ModelSerializer):
    """
    Сериализатор участника проекта (в т.ч. теневого).
    При создании: contact_id (новый поток) или user (legacy).
    В ответе: contact — вложенный объект при наличии связи (HR-SPRINT 3).
    """
    avatar_url = serializers.SerializerMethodField(read_only=True)
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        required=True,
    )
    contact_id = serializers.PrimaryKeyRelatedField(
        queryset=Contact.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
        source='contact',
    )
    contact = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ProjectMember
        fields = ['id', 'project', 'display_name', 'role', 'avatar_url', 'hourly_rate', 'contact_id', 'contact']
        read_only_fields = ['id', 'contact']

    def get_avatar_url(self, obj):
        """URL аватара из user или из contact.user."""
        user = obj.user
        if not user and obj.contact and obj.contact.user:
            user = obj.contact.user
        if user and user.avatar:
            request = self.context.get('request')
            return request.build_absolute_uri(user.avatar.url) if request else user.avatar.url
        return None

    def get_contact(self, obj):
        """Вложенный контакт при наличии связи."""
        if not obj.contact_id:
            return None
        c = obj.contact
        request = self.context.get('request')
        avatar_url = None
        if c.user and c.user.avatar:
            avatar_url = request.build_absolute_uri(c.user.avatar.url) if request else c.user.avatar.url
        return {
            'id': c.id,
            'first_name': c.first_name,
            'last_name': c.last_name,
            'email': c.email or '',
            'user': c.user_id,
            'avatar_url': avatar_url,
        }

    def create(self, validated_data):
        contact = validated_data.pop('contact', None)
        project = validated_data['project']
        workspace_id = project.workspace_id

        if contact is not None:
            if contact.workspace_id != workspace_id:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'contact_id': 'Контакт должен относиться к workspace проекта.'})
            validated_data['user'] = contact.user
            validated_data['contact'] = contact
            if not validated_data.get('display_name'):
                validated_data['display_name'] = (
                    f"{contact.last_name or ''} {contact.first_name or ''}".strip()
                    or contact.email
                    or f"Контакт #{contact.id}"
                )
            if validated_data.get('hourly_rate') is None and contact.tariff_rate is not None:
                validated_data['hourly_rate'] = contact.tariff_rate
            if validated_data.get('hourly_rate') is None:
                validated_data['hourly_rate'] = 0
        else:
            user = validated_data.get('user')
            if user is not None:
                from apps.hr.models import Contact
                contacts_in_workspace = Contact.objects.filter(workspace_id=workspace_id, user=user)
                if contacts_in_workspace.count() == 1:
                    validated_data['contact'] = contacts_in_workspace.get()

        return super().create(validated_data)


class UserSerializer(serializers.ModelSerializer):
    """Сериализатор пользователя (профиль, me)."""

    avatar = serializers.SerializerMethodField(read_only=True)
    avatar_file = serializers.ImageField(write_only=True, required=False)
    company = serializers.SerializerMethodField(read_only=True)
    company_id = serializers.PrimaryKeyRelatedField(
        queryset=Company.objects.all(),
        source='company',
        required=False,
        allow_null=True,
        write_only=True
    )

    groups = serializers.SerializerMethodField(read_only=True)
    plan_type = serializers.SerializerMethodField(read_only=True)
    show_ads = serializers.SerializerMethodField(read_only=True)
    personal_workspace_id = serializers.SerializerMethodField(read_only=True)
    personal_project_id = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'avatar', 'avatar_file', 'company', 'company_id',
            'timezone', 'telegram_username', 'telegram_id', 'date_joined',
            'groups', 'is_superuser', 'is_onboarded',
            'plan_type', 'show_ads',
            'personal_workspace_id', 'personal_project_id',
        ]
        read_only_fields = ['id', 'username', 'date_joined', 'telegram_id', 'is_superuser', 'is_onboarded']

    def _get_plan_type_and_show_ads(self, obj):
        """Суперюзер/staff или force_business_plan -> business, без рекламы; платная подписка -> business; иначе personal. Реклама: только personal и не hide_ads."""
        if getattr(obj, 'is_superuser', False) or getattr(obj, 'is_staff', False):
            return 'business', False
        if getattr(obj, 'force_business_plan', False):
            return 'business', False
        try:
            sub = getattr(obj, 'subscription', None)
            if sub and getattr(sub, 'is_active', True):
                if getattr(sub, 'plan', None) != Subscription.PLAN_FREE:
                    return 'business', False
                if getattr(sub, 'plan_obj', None) and sub.plan_obj and getattr(sub.plan_obj, 'price', 0) and sub.plan_obj.price > 0:
                    return 'business', False
        except Exception:
            pass
        show_ads = not getattr(obj, 'hide_ads', False)
        return 'personal', show_ads

    def get_plan_type(self, obj):
        return self._get_plan_type_and_show_ads(obj)[0]

    def get_show_ads(self, obj):
        return self._get_plan_type_and_show_ads(obj)[1]

    def get_personal_workspace_id(self, obj):
        from apps.core.services import get_default_workspace_and_project
        workspace, _ = get_default_workspace_and_project(obj)
        return workspace.id if workspace else None

    def get_personal_project_id(self, obj):
        from apps.core.services import get_default_workspace_and_project
        _, project = get_default_workspace_and_project(obj)
        return project.id if project else None

    def get_groups(self, obj):
        """Список групп пользователя (для RBAC на фронте)."""
        return list(obj.groups.values_list('name', flat=True))

    def get_avatar(self, obj):
        """Полный URL аватара для фронтенда."""
        if obj.avatar:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url
        return None

    def get_company(self, obj):
        """Данные компании пользователя."""
        if obj.company:
            return {
                'id': obj.company.id,
                'name': obj.company.name,
                'short_name': obj.company.short_name or '',
            }
        return None

    def update(self, instance, validated_data):
        """Обновление профиля с поддержкой avatar."""
        avatar_file = validated_data.pop('avatar_file', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if avatar_file is not None:
            if instance.avatar:
                instance.avatar.delete(save=False)
            instance.avatar = avatar_file
        instance.save()
        return instance


class WorkspaceSerializer(serializers.ModelSerializer):
    """Сериализатор для Workspace."""

    projects_count = serializers.IntegerField(source='projects.count', read_only=True)
    members_count = serializers.IntegerField(source='memberships.count', read_only=True)
    user_role = serializers.SerializerMethodField()
    logo = serializers.ImageField(required=False, allow_null=True, write_only=True)
    logo_url = serializers.SerializerMethodField(read_only=True)
    companies = serializers.PrimaryKeyRelatedField(
        queryset=Company.objects.all(),
        many=True,
        required=False,
        allow_empty=True
    )
    owner = serializers.SerializerMethodField(read_only=True)
    progress = serializers.IntegerField(read_only=True)
    health_status = serializers.CharField(read_only=True)

    class Meta:
        model = Workspace
        fields = [
            'id', 'name', 'slug', 'description', 'logo', 'logo_url', 'settings',
            'projects_count', 'members_count', 'user_role',
            'companies', 'owner',
            'progress', 'health_status',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'progress', 'health_status']
    
    def get_logo_url(self, obj):
        """Полный URL логотипа для фронтенда."""
        if obj.logo:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.logo.url) if request else obj.logo.url
        return None
    
    def validate_logo(self, value):
        """Ограничение: изображения до 5 МБ, форматы JPEG/PNG/GIF/WebP."""
        if not value:
            return value
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Размер файла не должен превышать 5 МБ.')
        allowed = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
        if getattr(value, 'content_type', None) not in allowed:
            raise serializers.ValidationError('Допустимые форматы: JPEG, PNG, GIF, WebP.')
        return value

    def create(self, validated_data):
        """Создание workspace: logo и companies обрабатываем после сохранения (M2M/файл)."""
        logo = validated_data.pop('logo', None)
        companies = validated_data.pop('companies', None)
        instance = Workspace.objects.create(**validated_data)
        if logo is not None:
            instance.logo = logo
            instance.save(update_fields=['logo'])
        if companies is not None:
            instance.companies.set(companies)
        return instance

    def update(self, instance, validated_data):
        """Обновление workspace с корректной обработкой логотипа и companies."""
        logo = validated_data.pop('logo', None)
        companies = validated_data.pop('companies', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if logo is not None:
            if instance.logo:
                instance.logo.delete(save=False)
            instance.logo = logo
        instance.save()
        if companies is not None:
            instance.companies.set(companies)
        return instance
    
    def get_user_role(self, obj):
        """Получить роль текущего пользователя в workspace."""
        request = self.context.get('request')
        if not request or not request.user:
            return None
        try:
            membership = WorkspaceMember.objects.get(
                workspace=obj,
                user=request.user
            )
            return membership.role
        except WorkspaceMember.DoesNotExist:
            return None

    def get_owner(self, obj):
        """Владелец workspace (первый участник с ролью owner)."""
        try:
            owner_membership = WorkspaceMember.objects.filter(
                workspace=obj,
                role=WorkspaceMember.ROLE_OWNER
            ).select_related('user').first()
            if owner_membership:
                u = owner_membership.user
                return {
                    'id': u.id,
                    'username': u.username,
                    'email': u.email or '',
                    'first_name': u.first_name or '',
                    'last_name': u.last_name or '',
                }
        except Exception:
            pass
        return None


class WorkspaceMemberSerializer(serializers.ModelSerializer):
    """Сериализатор для WorkspaceMember."""
    
    user = serializers.SerializerMethodField()
    workspace_name = serializers.CharField(source='workspace.name', read_only=True)
    
    class Meta:
        model = WorkspaceMember
        fields = [
            'id', 'workspace', 'workspace_name', 'user', 'role',
            'joined_at'
        ]
        read_only_fields = ['joined_at']
    
    def get_user(self, obj):
        """Информация о пользователе."""
        return {
            'id': obj.user.id,
            'username': obj.user.username,
            'email': obj.user.email,
            'first_name': obj.user.first_name,
            'last_name': obj.user.last_name,
        }
