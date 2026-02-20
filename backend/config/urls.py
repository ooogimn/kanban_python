"""
URL configuration for Office Suite 360 project.
"""
from django.contrib import admin

admin.site.site_header = 'Администрирование'
admin.site.site_title = 'Админка'
admin.site.index_title = 'Панель управления'

from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from apps.auth.views import profile_me, finish_onboarding

# Редирект с корня на фронт (в dev — http://localhost:3000), чтобы GET / не давал 404
urlpatterns = [
    path('', RedirectView.as_view(url=settings.FRONTEND_URL, permanent=False)),
    path('admin/', admin.site.urls),
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    
    # API v1
    path('api/v1/me/', profile_me, name='profile_me'),
    path('api/v1/users/finish-onboarding/', finish_onboarding, name='finish_onboarding'),
    path('api/v1/auth/', include('apps.auth.urls')),
    path('api/v1/core/', include('apps.core.urls')),
    path('api/v1/crm/', include('apps.crm.urls')),
    path('api/v1/todo/', include('apps.todo.urls')),
    path('api/v1/kanban/', include('apps.kanban.urls')),
    path('api/v1/calendar/', include('apps.calendar.urls')),
    path('api/v1/schedule/', include('apps.schedule.urls')),
    path('api/v1/gantt/', include('apps.gantt.urls')),
    path('api/v1/analytics/', include('apps.analytics.urls')),
    path('api/v1/integrations/', include('apps.integrations.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/timetracking/', include('apps.timetracking.urls')),
    path('api/v1/documents/', include('apps.documents.urls')),
    path('api/v1/mindmaps/', include('apps.mindmaps.urls')),
    path('api/v1/finance/', include('apps.finance.urls')),
    path('api/v1/billing/', include('apps.billing.urls')),
    path('api/v1/hr/', include('apps.hr.urls')),
    path('api/v1/goals/', include('apps.goals.urls')),
    path('api/v1/inbox/', include('apps.inbox.urls')),
    path('api/v1/automation/', include('apps.automation.urls')),
    path('api/v1/templates/', include('apps.templates.urls')),
    path('api/v1/habits/', include('apps.habits.urls')),
    path('api/v1/ai/', include('apps.ai.urls')),
    path('api/v1/saas/', include('apps.saas.urls')),
    path('api/v1/blog/', include('apps.blog.api.urls')),
    path('api/v1/marketing/', include('apps.marketing.api.urls')),

    # Health check
    path('api/health/', include('apps.core.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    if 'debug_toolbar' in settings.INSTALLED_APPS:
        urlpatterns += [path('__debug__/', include('debug_toolbar.urls'))]
