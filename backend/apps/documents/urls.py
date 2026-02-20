"""
URLs for documents app.
"""
from django.urls import path, include
from config.routers import NoFormatSuffixRouter
from .views import AttachmentViewSet, CommentViewSet, WikiPageViewSet

router = NoFormatSuffixRouter()
router.register(r'attachments', AttachmentViewSet, basename='attachment')
router.register(r'comments', CommentViewSet, basename='comment')
router.register(r'wiki/pages', WikiPageViewSet, basename='wikipage')

urlpatterns = [
    path('', include(router.urls)),
]
