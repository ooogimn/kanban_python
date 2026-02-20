"""
URL configuration for finance app.
"""
from django.urls import path, include
from config.routers import NoFormatSuffixRouter

from .views import (
    BankConnectionViewSet,
    CategoryViewSet,
    FinanceAnalyticsViewSet,
    ProjectBudgetViewSet,
    TransactionViewSet,
    WalletViewSet,
)

router = NoFormatSuffixRouter()
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'wallets', WalletViewSet, basename='wallet')
router.register(r'categories', CategoryViewSet, basename='finance-category')
router.register(r'bank-connections', BankConnectionViewSet, basename='bank-connection')
router.register(r'projects', ProjectBudgetViewSet, basename='project-budget')
router.register(r'analytics', FinanceAnalyticsViewSet, basename='finance-analytics')

urlpatterns = [
    path('', include(router.urls)),
]
