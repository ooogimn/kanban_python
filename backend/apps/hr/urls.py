from django.urls import path, include
from config.routers import NoFormatSuffixRouter
from .views import (
    ContactViewSet,
    PayrollStatsView,
    PayrollPayView,
    DepartmentViewSet,
    EmployeeViewSet,
    EmployeeDocumentViewSet,
    LeaveRequestViewSet,
    PayrollRunViewSet,
    PayrollItemViewSet,
)

router = NoFormatSuffixRouter()
router.register(r'contacts', ContactViewSet, basename='hr-contact')
router.register(r'departments', DepartmentViewSet, basename='hr-department')
router.register(r'employees', EmployeeViewSet, basename='hr-employee')
router.register(r'employee-documents', EmployeeDocumentViewSet, basename='hr-employee-document')
router.register(r'leave-requests', LeaveRequestViewSet, basename='hr-leave-request')
router.register(r'payroll-runs', PayrollRunViewSet, basename='hr-payroll-run')
router.register(r'payroll-items', PayrollItemViewSet, basename='hr-payroll-item')

urlpatterns = [
    path('', include(router.urls)),
    path('payroll/stats/', PayrollStatsView.as_view(), name='hr-payroll-stats'),
    path('payroll/pay/', PayrollPayView.as_view(), name='hr-payroll-pay'),
]
