"""
Serializers for SaaS API (Super Admin).
"""
from rest_framework import serializers
from django.utils.text import slugify
from .models import Plan
from apps.blog.models import Category, Post, Tag
from apps.marketing.models import Advertisement


def generate_unique_slug(title: str, exclude_post_id: int | None = None) -> str:
    """Генерирует уникальный slug из заголовка."""
    base = slugify(title) or 'post'
    base = base[:255]
    slug = base
    n = 0
    qs = Post.objects.filter(slug=slug)
    if exclude_post_id:
        qs = qs.exclude(pk=exclude_post_id)
    while qs.exists():
        n += 1
        suffix = f'-{n}'
        slug = (base[: 255 - len(suffix)] + suffix) if len(base) + len(suffix) > 255 else base + suffix
        qs = Post.objects.filter(slug=slug)
        if exclude_post_id:
            qs = qs.exclude(pk=exclude_post_id)
    return slug


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            'id', 'name', 'price', 'currency', 'limits',
            'is_active', 'is_default', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class PlanCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            'name', 'price', 'currency', 'limits',
            'is_active', 'is_default',
        ]


class SaasCategorySerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'sort_order']

    def create(self, validated_data):
        if not validated_data.get('slug', '').strip():
            base = slugify(validated_data['name'])[:100] or 'category'
            slug = base
            n = 0
            while Category.objects.filter(slug=slug).exists():
                n += 1
                slug = f'{base}-{n}'[:100]
            validated_data['slug'] = slug
        return super().create(validated_data)


class SaasTagSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug']

    def create(self, validated_data):
        if not validated_data.get('slug', '').strip():
            base = slugify(validated_data['name'])[:50] or 'tag'
            slug = base
            n = 0
            while Tag.objects.filter(slug=slug).exists():
                n += 1
                slug = f'{base}-{n}'[:50]
            validated_data['slug'] = slug
        return super().create(validated_data)


class SaasPostSerializer(serializers.ModelSerializer):
    """Полный CRUD поста для SaaS Admin. Slug при создании генерируется из заголовка."""
    image_url = serializers.SerializerMethodField(read_only=True)
    video_url = serializers.SerializerMethodField(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    tag_ids = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Post
        fields = [
            'id', 'title', 'slug', 'excerpt', 'content', 'image', 'image_url',
            'video', 'video_url', 'main_media_autoplay',
            'category', 'category_name', 'tag_ids',
            'is_published', 'published_at', 'views_count', 'created_at', 'updated_at',
        ]

    def get_tag_ids(self, obj):
        return list(obj.tags.values_list('id', flat=True))
        read_only_fields = ['views_count', 'created_at', 'updated_at']

    def create(self, validated_data):
        tag_ids = self.initial_data.get('tag_ids') if isinstance(self.initial_data, dict) else None
        if not validated_data.get('slug', '').strip():
            validated_data['slug'] = generate_unique_slug(validated_data['title'])
        instance = super().create(validated_data)
        if tag_ids is not None:
            instance.tags.set(tag_ids)
        return instance

    def update(self, instance, validated_data):
        tag_ids = self.initial_data.get('tag_ids') if isinstance(self.initial_data, dict) else None
        if 'slug' in validated_data and not (validated_data.get('slug') or '').strip():
            title = validated_data.get('title') or instance.title
            validated_data['slug'] = generate_unique_slug(title, exclude_post_id=instance.pk)
        super().update(instance, validated_data)
        if tag_ids is not None:
            instance.tags.set(tag_ids)
        return instance

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


class SaasAdvertisementSerializer(serializers.ModelSerializer):
    """CRUD объявления для SaaS Admin (image, video, html)."""
    image_url = serializers.SerializerMethodField(read_only=True)
    video_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Advertisement
        fields = [
            'id', 'title', 'slot', 'content_type', 'image', 'image_url',
            'video', 'video_url', 'html_code', 'link', 'is_active', 'width', 'height', 'sort_order',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

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
