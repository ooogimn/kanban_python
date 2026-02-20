"""
URL-маршруты API блога.
"""
from django.urls import path
from .views import (
    PostListAPIView,
    PostDetailAPIView,
    CategoryListAPIView,
    TagListAPIView,
)

urlpatterns = [
    path('posts/', PostListAPIView.as_view(), name='blog-post-list'),
    path('posts/<slug:slug>/', PostDetailAPIView.as_view(), name='blog-post-detail'),
    path('categories/', CategoryListAPIView.as_view(), name='blog-category-list'),
    path('tags/', TagListAPIView.as_view(), name='blog-tag-list'),
]
