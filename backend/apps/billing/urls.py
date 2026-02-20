"""
Billing URLs.
"""
from django.urls import path, include

from config.routers import NoFormatSuffixRouter
from .views import InvoiceViewSet

router = NoFormatSuffixRouter()
router.register(r'invoices', InvoiceViewSet, basename='invoice')

urlpatterns = [
    path('', include(router.urls)),
]
