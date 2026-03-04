"""
Authentication URLs for Office Suite 360.
"""
from django.urls import path
from rest_framework_simplejwt.views import TokenVerifyView
from apps.auth.views import (
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    telegram_login,
    telegram_link,
    register,
    verify_code,
    profile_me,
    invite_token_info,
    has_password,
    set_password,
    request_password_reset,
    reset_password,
    request_password_change,
    change_password,
)
from apps.auth.social_views import (
    social_providers,
    social_start,
    social_callback,
    social_exchange,
)

urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('me/', profile_me, name='profile_me'),
    path('telegram/', telegram_login, name='telegram_login'),
    path('telegram/link/', telegram_link, name='telegram_link'),
    path('register/', register, name='register'),
    path('invite/<str:token>/', invite_token_info, name='invite_token_info'),
    path('verify-code/', verify_code, name='verify_code'),
    path('password-reset/request/', request_password_reset, name='request_password_reset'),
    path('password-reset/confirm/', reset_password, name='reset_password'),
    path('password-change/request/', request_password_change, name='request_password_change'),
    path('password-change/confirm/', change_password, name='change_password'),
    path('password/has/', has_password, name='has_password'),
    path('password/set/', set_password, name='set_password'),
    path('social/providers/', social_providers, name='social_providers'),
    path('social/<str:provider>/start/', social_start, name='social_start'),
    path('social/<str:provider>/callback/', social_callback, name='social_callback'),
    path('social/<str:provider>/exchange/', social_exchange, name='social_exchange'),
]
