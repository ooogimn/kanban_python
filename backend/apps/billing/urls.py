"""
Billing URLs.
"""
from django.urls import path, include

from config.routers import NoFormatSuffixRouter
from .views import (
    InvoiceViewSet,
    BillingAccountViewSet,
    BillingUsageViewSet,
    BillingCabinetViewSet,
    BillingProviderViewSet,
)

router = NoFormatSuffixRouter()
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'account', BillingAccountViewSet, basename='billing-account')
router.register(r'usage', BillingUsageViewSet, basename='billing-usage')
router.register(r'cabinet', BillingCabinetViewSet, basename='billing-cabinet')
router.register(r'provider', BillingProviderViewSet, basename='billing-provider')

urlpatterns = [
    path('', include(router.urls)),
]
