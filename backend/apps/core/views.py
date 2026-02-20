"""
Views for core app.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from django.utils.text import slugify
from .models import Workspace, WorkspaceMember, User
from .serializers import WorkspaceSerializer, WorkspaceMemberSerializer, UserSerializer
from apps.auth.permissions import IsWorkspaceMember, IsWorkspaceAdmin


def _user_can_create_multiple_workspaces(user):
    """Суперюзер, staff, принудительный бизнес-тариф или платная подписка — можно создавать несколько пространств."""
    if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
        return True
    if getattr(user, 'force_business_plan', False):
        return True
    try:
        from apps.billing.models import Subscription
        sub = getattr(user, 'subscription', None)
        if sub and getattr(sub, 'is_active', True):
            if getattr(sub, 'plan', None) != Subscription.PLAN_FREE:
                return True
            if getattr(sub, 'plan_obj', None) and sub.plan_obj and getattr(sub.plan_obj, 'price', 0) and sub.plan_obj.price > 0:
                return True
    except Exception:
        pass
    return False


class UserViewSet(viewsets.GenericViewSet):
    """
    ViewSet для управления профилем текущего пользователя (чтение/обновление me).
    """
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return User.objects.filter(id=self.request.user.id).select_related('company')

    @action(detail=False, methods=['get', 'patch', 'put'], url_path='me')
    def me(self, request):
        """
        GET — данные текущего пользователя.
        PATCH / PUT — обновление профиля (first_name, last_name, email, role, avatar, company).
        """
        user = request.user
        if request.method == 'GET':
            serializer = self.get_serializer(user)
            return Response(serializer.data)
        partial = request.method == 'PATCH'
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data or {})
        if request.FILES.get('avatar'):
            data['avatar_file'] = request.FILES.get('avatar')
        elif 'avatar' in data and data['avatar'] is None:
            data.pop('avatar', None)
        serializer = self.get_serializer(user, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class WorkspaceViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления workspace (пространствами).
    """
    queryset = Workspace.objects.all()
    serializer_class = WorkspaceSerializer
    permission_classes = [IsWorkspaceMember]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get_queryset(self):
        """Возвращаем workspace, в которых состоит пользователь; для staff без членства — все (восстановление доступа)."""
        user = self.request.user
        if not user or not user.is_authenticated:
            return Workspace.objects.none()

        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        )
        if workspace_ids:
            return Workspace.objects.filter(id__in=workspace_ids).order_by('id').prefetch_related(
                'projects', 'memberships', 'companies'
            )
        # Staff без членства — показываем все workspace (данные есть, членства могли потеряться)
        if getattr(user, 'is_staff', False):
            return Workspace.objects.all().order_by('id').prefetch_related(
                'projects', 'memberships', 'companies'
            )
        return Workspace.objects.none()
    
    def perform_create(self, serializer):
        """При создании workspace автоматически ставим owner и добавляем пользователя в members."""
        workspace = serializer.save()
        WorkspaceMember.objects.create(
            workspace=workspace,
            user=self.request.user,
            role=WorkspaceMember.ROLE_OWNER
        )
    
    def create(self, request, *args, **kwargs):
        """Создание workspace. Для личного аккаунта — только одно (личное); при бизнес-тарифе/суперюзере/staff/force_business_plan разрешено создавать дополнительные."""
        from apps.core.services import get_default_workspace_and_project
        user = request.user
        can_create_more = _user_can_create_multiple_workspaces(user)
        ws, _ = get_default_workspace_and_project(user)
        if not can_create_more and ws is not None:
            return Response(
                {'detail': 'У личного аккаунта одно пространство создаётся автоматически. Перейдите на бизнес-тариф для создания дополнительных пространств.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data or {})
        if request.FILES.get('logo'):
            data['logo'] = request.FILES.get('logo')

        # Генерируем slug из name, если не передан
        if not data.get('slug'):
            name = (data.get('name') or '').strip()
            if name:
                base_slug = slugify(name)
                slug = base_slug or 'workspace'
            else:
                base_slug = 'workspace'
                slug = base_slug
            counter = 1
            while Workspace.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            data['slug'] = slug
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def update(self, request, *args, **kwargs):
        """Обновление workspace с поддержкой multipart/form-data для логотипа."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if request.FILES.get('logo'):
            data['logo'] = request.FILES.get('logo')
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], permission_classes=[IsWorkspaceMember])
    def members(self, request, pk=None):
        """Получить список участников workspace."""
        workspace = self.get_object()
        members = WorkspaceMember.objects.filter(workspace=workspace).select_related('user')
        serializer = WorkspaceMemberSerializer(members, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[IsWorkspaceMember])
    def current(self, request):
        """Текущий (первый) workspace пользователя для дашборда и фильтров."""
        qs = self.get_queryset()
        workspace = qs.first()
        if not workspace:
            return Response({'detail': 'Нет доступных пространств'}, status=status.HTTP_404_NOT_FOUND)
        return Response(WorkspaceSerializer(workspace).data)

    @action(detail=True, methods=['get'], permission_classes=[IsWorkspaceMember])
    def projects(self, request, pk=None):
        """Получить список проектов workspace."""
        workspace = self.get_object()
        from apps.todo.models import Project
        from apps.todo.serializers import ProjectSerializer
        projects = Project.objects.filter(workspace=workspace)
        serializer = ProjectSerializer(projects, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsWorkspaceAdmin])
    def add_member(self, request, pk=None):
        """Добавить участника в workspace (только для admin/owner)."""
        workspace = self.get_object()
        user_id = request.data.get('user_id')
        role = request.data.get('role', WorkspaceMember.ROLE_MEMBER)
        
        if not user_id:
            return Response(
                {'detail': 'user_id обязателен'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from apps.core.models import User
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Пользователь не найден'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        membership, created = WorkspaceMember.objects.get_or_create(
            workspace=workspace,
            user=user,
            defaults={'role': role}
        )
        
        if not created:
            membership.role = role
            membership.save()
        
        serializer = WorkspaceMemberSerializer(membership)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
    
    @action(detail=True, methods=['delete'], permission_classes=[IsWorkspaceAdmin], url_path='members/(?P<member_id>[^/.]+)')
    def remove_member(self, request, pk=None, member_id=None):
        """Удалить участника из workspace (только для admin/owner)."""
        workspace = self.get_object()
        try:
            membership = WorkspaceMember.objects.get(
                workspace=workspace,
                id=member_id
            )
            # Нельзя удалить owner
            if membership.role == WorkspaceMember.ROLE_OWNER:
                return Response(
                    {'detail': 'Нельзя удалить владельца workspace'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            membership.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except WorkspaceMember.DoesNotExist:
            return Response(
                {'detail': 'Участник не найден'},
                status=status.HTTP_404_NOT_FOUND
            )
