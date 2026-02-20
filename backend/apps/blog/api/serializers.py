"""
Сериализаторы API блога.
"""
from rest_framework import serializers
from apps.blog.models import Category, Post, Tag


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug']


class PostListSerializer(serializers.ModelSerializer):
    """Краткий вывод поста для списка (в т.ч. video_url, category, tags)."""
    image_url = serializers.SerializerMethodField(read_only=True)
    video_url = serializers.SerializerMethodField(read_only=True)
    category_id = serializers.SerializerMethodField(read_only=True)
    category_name = serializers.SerializerMethodField(read_only=True)
    category_slug = serializers.SerializerMethodField(read_only=True)
    tag_ids = serializers.SerializerMethodField(read_only=True)
    tag_names = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Post
        fields = [
            'id', 'title', 'slug', 'excerpt', 'image_url', 'video_url',
            'category_id', 'category_name', 'category_slug',
            'tag_ids', 'tag_names',
            'published_at', 'views_count', 'created_at',
        ]

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None

    def get_video_url(self, obj):
        if obj.video:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.video.url) if request else obj.video.url
        return None

    def get_category_id(self, obj):
        return obj.category_id

    def get_category_name(self, obj):
        return obj.category.name if obj.category else None

    def get_category_slug(self, obj):
        return obj.category.slug if obj.category else None

    def get_tag_ids(self, obj):
        return list(obj.tags.values_list('id', flat=True))

    def get_tag_names(self, obj):
        return list(obj.tags.values_list('name', flat=True))


class PostDetailSerializer(serializers.ModelSerializer):
    """Полный вывод поста для детальной страницы."""
    image_url = serializers.SerializerMethodField(read_only=True)
    video_url = serializers.SerializerMethodField(read_only=True)
    category_id = serializers.SerializerMethodField(read_only=True)
    category_name = serializers.SerializerMethodField(read_only=True)
    category_slug = serializers.SerializerMethodField(read_only=True)
    tags = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Post
        fields = [
            'id', 'title', 'slug', 'excerpt', 'content', 'image', 'image_url',
            'video_url', 'main_media_autoplay',
            'category_id', 'category_name', 'category_slug', 'tags',
            'is_published', 'published_at', 'views_count', 'created_at', 'updated_at',
        ]

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None

    def get_video_url(self, obj):
        if obj.video:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.video.url) if request else obj.video.url
        return None

    def get_category_id(self, obj):
        return obj.category_id

    def get_category_name(self, obj):
        return obj.category.name if obj.category else None

    def get_category_slug(self, obj):
        return obj.category.slug if obj.category else None

    def get_tags(self, obj):
        return [{'id': t.id, 'name': t.name, 'slug': t.slug} for t in obj.tags.all()]
