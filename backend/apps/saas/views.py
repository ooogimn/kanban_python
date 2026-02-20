"""
SaaS API — Super Admin: dashboard stats, plans CRUD, users list/ban/impersonate.
Все методы требуют IsSuperUser.
"""
from decimal import Decimal
from datetime import timedelta
import os
import uuid

from django.db.models import Count, Sum
from django.core.files.storage import default_storage
from django.utils import timezone
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser

from django.contrib.auth import get_user_model
from apps.auth.permissions import IsSuperUser
from apps.core.models import Workspace, UserEvent
from apps.billing.models import Subscription
from .models import Plan
from .serializers import (
    PlanSerializer,
    PlanCreateUpdateSerializer,
    SaasPostSerializer,
    SaasAdvertisementSerializer,
    SaasCategorySerializer,
    SaasTagSerializer,
)
from apps.blog.models import Category, Post, Tag
from apps.marketing.models import Advertisement

User = get_user_model()


class SaasDashboardViewSet(viewsets.ViewSet):
    """GET /stats/ — total_users, active_workspaces, mrr."""
    permission_classes = [IsAuthenticated, IsSuperUser]

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        total_users = User.objects.count()
        active_workspaces = Workspace.objects.count()
        active_subs = Subscription.objects.filter(is_active=True).select_related('plan_obj')
        mrr = Decimal('0')
        for sub in active_subs:
            if sub.plan_obj and sub.plan_obj.price is not None:
                mrr += sub.plan_obj.price

        # Регистрации по месяцам (последние 6 месяцев) для графика
        six_months_ago = timezone.now() - timedelta(days=180)
        by_month = (
            User.objects.filter(date_joined__gte=six_months_ago)
            .annotate(month=TruncMonth('date_joined'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month')
        )
        registrations = [{'month': r['month'].strftime('%Y-%m') if r['month'] else None, 'count': r['count']} for r in by_month]

        return Response({
            'total_users': total_users,
            'active_workspaces': active_workspaces,
            'mrr': str(mrr),
            'registrations': registrations,
        })


class SaasPlanViewSet(viewsets.ModelViewSet):
    """CRUD для планов."""
    queryset = Plan.objects.all()
    permission_classes = [IsAuthenticated, IsSuperUser]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return PlanCreateUpdateSerializer
        return PlanSerializer


class SaasUserViewSet(viewsets.ViewSet):
    """
    Список пользователей, ban, impersonate, manage-access (PATCH force_business).
    """
    permission_classes = [IsAuthenticated, IsSuperUser]

    def get_permissions(self):
        if self.action == 'manage_access':
            return [IsAuthenticated(), IsAdminUser()]
        return [IsAuthenticated(), IsSuperUser()]

    def list(self, request):
        users = User.objects.annotate(
            workspace_count=Count('workspace_memberships', distinct=True),
        ).order_by('-date_joined')
        data = [
            {
                'id': u.id,
                'username': u.username,
                'email': u.email or '',
                'first_name': u.first_name or '',
                'last_name': u.last_name or '',
                'is_active': u.is_active,
                'is_superuser': u.is_superuser,
                'workspace_count': u.workspace_count,
                'date_joined': u.date_joined.isoformat() if u.date_joined else None,
                'force_business_plan': getattr(u, 'force_business_plan', False),
                'hide_ads': getattr(u, 'hide_ads', False),
            }
            for u in users
        ]
        return Response(data)

    def retrieve(self, request, pk=None):
        try:
            u = User.objects.annotate(
                workspace_count=Count('workspace_memberships', distinct=True),
            ).get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'id': u.id,
            'username': u.username,
            'email': u.email or '',
            'first_name': u.first_name or '',
            'last_name': u.last_name or '',
            'is_active': u.is_active,
            'is_superuser': u.is_superuser,
            'workspace_count': u.workspace_count,
            'date_joined': u.date_joined.isoformat() if u.date_joined else None,
            'force_business_plan': getattr(u, 'force_business_plan', False),
            'hide_ads': getattr(u, 'hide_ads', False),
        })

    @action(detail=True, methods=['post'], url_path='ban')
    def ban(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        if user == request.user:
            return Response({'error': 'Cannot ban yourself'}, status=status.HTTP_400_BAD_REQUEST)
        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        return Response({'is_active': user.is_active})

    @action(detail=True, methods=['post'], url_path='impersonate')
    def impersonate(self, request, pk=None):
        from rest_framework_simplejwt.tokens import RefreshToken
        try:
            target_user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        if not target_user.is_active:
            return Response({'error': 'User is inactive'}, status=status.HTTP_400_BAD_REQUEST)
        refresh = RefreshToken.for_user(target_user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        })

    @action(detail=True, methods=['patch'], url_path='manage-access')
    def manage_access(self, request, pk=None):
        """Тело: { "force_business": boolean }. Только IsAdminUser. Пишет событие business_on/off."""
        force_business = request.data.get('force_business')
        if force_business is None:
            return Response(
                {'error': 'force_business (boolean) is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        event_type = UserEvent.EVENT_BUSINESS_ON if force_business else UserEvent.EVENT_BUSINESS_OFF
        user.force_business_plan = bool(force_business)
        user.save(update_fields=['force_business_plan'])
        UserEvent.objects.create(user=user, event_type=event_type)
        return Response({'force_business_plan': user.force_business_plan})

    @action(detail=True, methods=['patch'], url_path='manage-ads')
    def manage_ads(self, request, pk=None):
        """Тело: { "hide_ads": boolean }. Отключить/включить показ рекламы. Пишет событие ads_off/ads_on."""
        hide_ads = request.data.get('hide_ads')
        if hide_ads is None:
            return Response(
                {'error': 'hide_ads (boolean) is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        event_type = UserEvent.EVENT_ADS_OFF if hide_ads else UserEvent.EVENT_ADS_ON
        user.hide_ads = bool(hide_ads)
        user.save(update_fields=['hide_ads'])
        UserEvent.objects.create(user=user, event_type=event_type)
        return Response({'hide_ads': user.hide_ads})

    @action(detail=True, methods=['get'], url_path='events')
    def events(self, request, pk=None):
        """Список событий пользователя (логин, реклама, бизнес, платежи) для аналитики."""
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        events = UserEvent.objects.filter(user=user).order_by('-created_at')[:200]
        data = [
            {
                'id': e.id,
                'event_type': e.event_type,
                'created_at': e.created_at.isoformat(),
                'details': e.details,
                'amount': str(e.amount) if e.amount is not None else None,
            }
            for e in events
        ]
        return Response(data)

    @action(detail=True, methods=['post'], url_path='add-payment')
    def add_payment(self, request, pk=None):
        """Добавить платёж вручную. Тело: { "amount": number, "details": {} }."""
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        amount = request.data.get('amount')
        details = request.data.get('details') or {}
        if amount is None:
            return Response({'error': 'amount is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            amount_decimal = Decimal(str(amount))
        except Exception:
            return Response({'error': 'amount must be a number'}, status=status.HTTP_400_BAD_REQUEST)
        e = UserEvent.objects.create(
            user=user,
            event_type=UserEvent.EVENT_PAYMENT,
            amount=amount_decimal,
            details=details,
        )
        return Response({
            'id': e.id,
            'event_type': e.event_type,
            'created_at': e.created_at.isoformat(),
            'amount': str(e.amount),
            'details': e.details,
        }, status=status.HTTP_201_CREATED)


class SaasCategoryViewSet(viewsets.ModelViewSet):
    """CRUD категорий блога для SaaS Admin."""
    queryset = Category.objects.all().order_by('sort_order', 'name')
    serializer_class = SaasCategorySerializer
    permission_classes = [IsAuthenticated, IsSuperUser]


class SaasTagViewSet(viewsets.ModelViewSet):
    """CRUD тегов блога для SaaS Admin."""
    queryset = Tag.objects.all().order_by('name')
    serializer_class = SaasTagSerializer
    permission_classes = [IsAuthenticated, IsSuperUser]


class SaasPostViewSet(viewsets.ModelViewSet):
    """CRUD постов блога для SaaS Admin. Только IsSuperUser."""
    queryset = Post.objects.all().select_related('category').prefetch_related('tags').order_by('-created_at')
    serializer_class = SaasPostSerializer
    permission_classes = [IsAuthenticated, IsSuperUser]
    lookup_field = 'pk'

    @action(detail=False, methods=['post'], url_path='upload-media')
    def upload_media(self, request):
        """Загрузка изображения/видео для вставки в контент. Возвращает { url }."""
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'file required'}, status=status.HTTP_400_BAD_REQUEST)
        ext = os.path.splitext(file.name)[1] or '.bin'
        path = f"blog/uploads/{timezone.now().strftime('%Y/%m')}/{uuid.uuid4().hex}{ext}"
        saved = default_storage.save(path, file)
        url = request.build_absolute_uri(default_storage.url(saved))
        return Response({'url': url})


class SaasAdvertisementViewSet(viewsets.ModelViewSet):
    """CRUD рекламных объявлений для SaaS Admin. Только IsSuperUser."""
    queryset = Advertisement.objects.all().order_by('slot', 'sort_order', 'id')
    serializer_class = SaasAdvertisementSerializer
    permission_classes = [IsAuthenticated, IsSuperUser]


