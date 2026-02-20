from django.urls import path, include
from config.routers import NoFormatSuffixRouter

from .views import ProjectAnalyzeView
from .api.views import AiMarketplaceViewSet, WorkspaceAgentViewSet, TeamComparisonView

router = NoFormatSuffixRouter()
router.register(r'marketplace', AiMarketplaceViewSet, basename='ai-marketplace')
router.register(r'workspace-agents', WorkspaceAgentViewSet, basename='ai-workspace-agent')

urlpatterns = [
    path('analyze/', ProjectAnalyzeView.as_view(), name='ai-analyze'),
    path('team-comparison/', TeamComparisonView.as_view(), name='ai-team-comparison'),
    path('', include(router.urls)),
]
