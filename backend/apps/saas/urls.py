"""
URLs for SaaS API (Super Admin).
"""
from django.urls import path, include
from config.routers import NoFormatSuffixRouter

from .views import (
    SaasDashboardViewSet,
    SaasPlanViewSet,
    SaasUserViewSet,
    SaasCategoryViewSet,
    SaasTagViewSet,
    SaasPostViewSet,
    SaasAdvertisementViewSet,
)

router = NoFormatSuffixRouter()
router.register(r'dashboard', SaasDashboardViewSet, basename='saas-dashboard')
router.register(r'plans', SaasPlanViewSet, basename='saas-plan')
router.register(r'users', SaasUserViewSet, basename='saas-user')
router.register(r'blog/categories', SaasCategoryViewSet, basename='saas-blog-category')
router.register(r'blog/tags', SaasTagViewSet, basename='saas-blog-tag')
router.register(r'blog/posts', SaasPostViewSet, basename='saas-blog-post')
router.register(r'ads', SaasAdvertisementViewSet, basename='saas-ad')

urlpatterns = [
    path('', include(router.urls)),
]
