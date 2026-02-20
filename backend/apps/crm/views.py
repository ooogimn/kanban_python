"""
Views for CRM app.
"""
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils.text import slugify

from .models import Company, Customer
from .serializers import CompanySerializer, CustomerSerializer
from .services.context_service import CustomerContextService
from apps.auth.permissions import IsWorkspaceMember, IsDirectorOrManager
from apps.core.models import WorkspaceMember, User


class CompanyViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления компаниями (контрагентами).
    Пользователь видит только компании, к которым привязан (user.company или workspace.companies).
    Админ (is_staff) видит все.
    """
    serializer_class = CompanySerializer
    permission_classes = [IsWorkspaceMember, IsDirectorOrManager]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        """Фильтр: пользователь видит свои компании, админ — все."""
        user = self.request.user
        if not user or not user.is_authenticated:
            return Company.objects.none()

        if user.is_staff:
            return Company.objects.all().prefetch_related('files')

        workspace_ids = WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        return Company.objects.filter(
            Q(employees=user) |
            Q(workspaces__id__in=workspace_ids)
        ).distinct().prefetch_related('files')

    def perform_create(self, serializer):
        """При создании компании: привязываем текущего пользователя (user.company), если не указано иное."""
        company = serializer.save()

        link_to_me = self.request.data.get('link_to_me', True)
        if link_to_me in (True, 'true', '1', 'yes') and self.request.user:
            user = self.request.user
            if not user.company_id:
                user.company = company
                user.save(update_fields=['company'])

    def create(self, request, *args, **kwargs):
        """Создание компании с поддержкой multipart для логотипа."""
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data or {})
        if request.FILES.get('logo'):
            data['logo'] = request.FILES.get('logo')

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        """Обновление компании с поддержкой multipart для логотипа."""
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


class CustomerViewSet(viewsets.ModelViewSet):
    """
    ViewSet для управления клиентами (CRM-Lite).
    
    Строгая изоляция по workspace — пользователь видит только клиентов
    своих воркспейсов. Доступ только Director/Manager.
    
    Дополнительный action: get_context — досье клиента для ИИ.
    """
    queryset = Customer.objects.none()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, IsDirectorOrManager]
    
    def get_queryset(self):
        """Фильтрация по воркспейсам пользователя (строгая изоляция)."""
        user = self.request.user
        if not user or not user.is_authenticated:
            return Customer.objects.none()
        
        workspace_ids = list(
            WorkspaceMember.objects.filter(user=user).values_list(
                'workspace_id', flat=True
            )
        )
        
        # Опциональный фильтр по активному workspace_id
        active_workspace_id = self.request.query_params.get('workspace_id')
        if active_workspace_id:
            try:
                active_workspace_id = int(active_workspace_id)
                if active_workspace_id in workspace_ids:
                    workspace_ids = [active_workspace_id]
                else:
                    return Customer.objects.none()
            except (ValueError, TypeError):
                pass
        
        return (
            Customer.objects.filter(workspace_id__in=workspace_ids)
            .select_related('workspace')
            .prefetch_related('projects')
            .order_by('name')
        )
    
    def perform_create(self, serializer):
        """
        При создании клиента проверяем доступ к workspace.
        
        Если workspace не передан, используем первый доступный workspace
        пользователя.
        """
        workspace = serializer.validated_data.get('workspace')
        
        if not workspace:
            # Автоматическая привязка к первому workspace пользователя
            membership = WorkspaceMember.objects.filter(
                user=self.request.user
            ).select_related('workspace').first()
            
            if not membership:
                from rest_framework.exceptions import ValidationError
                raise ValidationError(
                    "У вас нет доступных workspace. Создайте workspace сначала."
                )
            
            serializer.save(workspace=membership.workspace)
        else:
            # Проверка доступа к указанному workspace
            if not WorkspaceMember.objects.filter(
                workspace=workspace, user=self.request.user
            ).exists():
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied(
                    "У вас нет доступа к этому workspace."
                )
            serializer.save()
    
    @action(detail=True, methods=['get'], url_path='context')
    def get_context(self, request, pk=None):
        """
        GET /api/v1/crm/customers/{id}/context/
        
        Возвращает досье клиента с агрегированными данными:
        - Базовая информация
        - Статистика (проекты, бюджеты, риски, задачи)
        - Контекстное резюме для ИИ
        
        Использует SQL aggregation (без N+1 запросов).
        """
        customer = self.get_object()
        
        try:
            dossier = CustomerContextService.get_customer_dossier(customer)
            return Response(dossier)
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception(
                f"Error generating dossier for customer {customer.id}"
            )
            return Response(
                {'error': 'Failed to generate customer dossier'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
