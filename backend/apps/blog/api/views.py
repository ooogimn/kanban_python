"""
API блога: публичный список и детальная страница поста, категории, теги.
"""
from django.db.models import F, Q
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.blog.models import Category, Post, Tag


class PostListAPIView(generics.ListAPIView):
    """
    GET /api/v1/blog/posts/
    Список опубликованных постов.
    Параметры: search (по названию), category (slug или id), tags (slug через запятую или id).
    """
    permission_classes = [AllowAny]
    serializer_class = None

    def get_serializer_class(self):
        from .serializers import PostListSerializer
        return PostListSerializer

    def get_queryset(self):
        qs = Post.objects.filter(is_published=True).select_related('category').prefetch_related('tags')
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(excerpt__icontains=search))
        category = self.request.query_params.get('category') or ''
        if category:
            if category.isdigit():
                qs = qs.filter(category_id=int(category))
            else:
                qs = qs.filter(category__slug=category)
        tags_param = (self.request.query_params.get('tags') or '').strip()
        if tags_param:
            slugs_or_ids = [s.strip() for s in tags_param.split(',') if s.strip()]
            if slugs_or_ids:
                for val in slugs_or_ids:
                    if val.isdigit():
                        qs = qs.filter(tags__id=int(val))
                    else:
                        qs = qs.filter(tags__slug=val)
        return qs.order_by('-published_at', '-created_at').distinct()


class PostDetailAPIView(generics.RetrieveAPIView):
    """
    GET /api/v1/blog/posts/<slug:slug>/
    Детальная страница опубликованного поста. При запросе увеличивает счётчик просмотров.
    """
    permission_classes = [AllowAny]
    lookup_field = 'slug'
    lookup_url_kwarg = 'slug'
    serializer_class = None

    def get_queryset(self):
        return Post.objects.filter(is_published=True).select_related('category').prefetch_related('tags')

    def get_serializer_class(self):
        from .serializers import PostDetailSerializer
        return PostDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        Post.objects.filter(pk=instance.pk).update(views_count=F('views_count') + 1)
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class CategoryListAPIView(generics.ListAPIView):
    """GET /api/v1/blog/categories/ — список категорий."""
    permission_classes = [AllowAny]
    queryset = Category.objects.all()
    serializer_class = None

    def get_serializer_class(self):
        from .serializers import CategorySerializer
        return CategorySerializer


class TagListAPIView(generics.ListAPIView):
    """GET /api/v1/blog/tags/ — список тегов."""
    permission_classes = [AllowAny]
    queryset = Tag.objects.all()
    serializer_class = None

    def get_serializer_class(self):
        from .serializers import TagSerializer
        return TagSerializer
