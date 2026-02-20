from django.urls import path, include
from config.routers import NoFormatSuffixRouter
from .views import ActivityLogViewSet

router = NoFormatSuffixRouter()
router.register(r'activity', ActivityLogViewSet, basename='activity')

urlpatterns = [
    path('', include(router.urls)),
]
