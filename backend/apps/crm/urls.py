from django.urls import path, include
from config.routers import NoFormatSuffixRouter
from .views import CompanyViewSet, CustomerViewSet

router = NoFormatSuffixRouter()
router.register(r'companies', CompanyViewSet, basename='company')
router.register(r'customers', CustomerViewSet, basename='customer')

urlpatterns = [
    path('', include(router.urls)),
]
