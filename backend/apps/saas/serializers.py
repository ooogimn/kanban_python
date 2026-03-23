"""
Serializers for SaaS API (Super Admin).
"""
import json
from rest_framework import serializers
from django.utils.text import slugify
from .models import Plan, SaasPlatformSettings
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
            'is_active', 'is_default', 'is_recommended',
            'recommended_badge', 'recommended_note',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class PlanCreateUpdateSerializer(serializers.ModelSerializer):
    LIMIT_KEYS = (
        'max_system_contacts',
        'max_ai_agents',
        'max_users',
        'max_projects',
        'storage_gb',
    )

    class Meta:
        model = Plan
        fields = [
            'name', 'price', 'currency', 'limits',
            'is_active', 'is_default', 'is_recommended',
            'recommended_badge', 'recommended_note',
        ]

    def validate_limits(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('limits должен быть объектом.')
        limits = dict(value)
        for key in self.LIMIT_KEYS:
            if key not in limits:
                continue
            raw = limits.get(key)
            try:
                num = float(raw)
            except (TypeError, ValueError):
                raise serializers.ValidationError({key: 'Значение лимита должно быть числом.'})
            if num < -1:
                raise serializers.ValidationError({key: 'Минимально допустимое значение: -1 (безлимит).'})
            # Для всех лимитов кроме storage_gb сохраняем целые числа.
            if key != 'storage_gb':
                limits[key] = int(num)
            else:
                limits[key] = round(num, 1)
        return limits

    def validate(self, attrs):
        attrs = super().validate(attrs)
        current_recommended = bool(getattr(self.instance, 'is_recommended', False))
        current_badge = str(getattr(self.instance, 'recommended_badge', '') or '').strip()
        current_note = str(getattr(self.instance, 'recommended_note', '') or '').strip()

        is_recommended = attrs.get('is_recommended')
        if is_recommended is None:
            is_recommended = current_recommended

        if 'recommended_badge' in attrs:
            badge = str(attrs.get('recommended_badge', '')).strip()
        else:
            badge = current_badge

        if 'recommended_note' in attrs:
            note = str(attrs.get('recommended_note', '')).strip()
        else:
            note = current_note

        if is_recommended:
            attrs['recommended_badge'] = badge or 'РЕКОМЕНДОВАН'
            attrs['recommended_note'] = note
        else:
            attrs['recommended_badge'] = ''
            attrs['recommended_note'] = ''
        return attrs


class RevenueByMonthItemSerializer(serializers.Serializer):
    month = serializers.CharField(allow_null=True)
    revenue = serializers.FloatField()
    count = serializers.IntegerField()


class RevenueByProviderItemSerializer(serializers.Serializer):
    provider = serializers.CharField()
    total = serializers.FloatField()
    count = serializers.IntegerField()


class RevenueByPlanItemSerializer(serializers.Serializer):
    plan = serializers.CharField()
    total = serializers.FloatField()
    count = serializers.IntegerField()


class SaasRevenueStatsSerializer(serializers.Serializer):
    total_users = serializers.IntegerField()
    active_workspaces = serializers.IntegerField()
    mrr = serializers.CharField()
    arr = serializers.CharField()
    active_subscriptions = serializers.IntegerField()
    trial_subscriptions = serializers.IntegerField()
    churn_count = serializers.IntegerField()
    registrations = serializers.JSONField()
    revenue_by_month = RevenueByMonthItemSerializer(many=True)
    revenue_by_provider = RevenueByProviderItemSerializer(many=True)
    revenue_by_plan = RevenueByPlanItemSerializer(many=True)


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
            'id', 'title', 'slug', 'excerpt', 'content',
            'meta_title', 'meta_description', 'canonical_url', 'og_image',
            'image', 'image_url',
            'video', 'video_url', 'main_media_autoplay',
            'category', 'category_name', 'tag_ids',
            'is_published', 'published_at', 'views_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['views_count', 'created_at', 'updated_at']

    def get_tag_ids(self, obj):
        return list(obj.tags.values_list('id', flat=True))

    def _parse_tag_ids(self):
        if not isinstance(self.initial_data, dict):
            return None
        raw = self.initial_data.get('tag_ids')
        if raw is None:
            return None
        if isinstance(raw, list):
            return [int(x) for x in raw]
        if isinstance(raw, str):
            value = raw.strip()
            if not value:
                return []
            # FormData often sends tag_ids as JSON string: "[1,2]"
            if value.startswith('['):
                try:
                    parsed = json.loads(value)
                except json.JSONDecodeError as exc:
                    raise serializers.ValidationError({'tag_ids': 'Некорректный формат tag_ids'}) from exc
                if not isinstance(parsed, list):
                    raise serializers.ValidationError({'tag_ids': 'Ожидается массив id тегов'})
                return [int(x) for x in parsed]
            # Fallback for comma-separated values: "1,2,3"
            return [int(x.strip()) for x in value.split(',') if x.strip()]
        raise serializers.ValidationError({'tag_ids': 'Некорректный формат tag_ids'})

    def create(self, validated_data):
        tag_ids = self._parse_tag_ids()
        if not validated_data.get('slug', '').strip():
            validated_data['slug'] = generate_unique_slug(validated_data['title'])
        instance = super().create(validated_data)
        if tag_ids is not None:
            instance.tags.set(tag_ids)
        return instance

    def update(self, instance, validated_data):
        tag_ids = self._parse_tag_ids()
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


class SaasPlatformSettingsSerializer(serializers.ModelSerializer):
    has_yookassa_secret = serializers.SerializerMethodField(read_only=True)
    yookassa_secret_key = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = SaasPlatformSettings
        fields = [
            'brand_name',
            'public_site_url',
            'yandex_webmaster_verification',
            'yandex_metrika_counter_id',
            'yandex_metrika_tag',
            'google_analytics_measurement_id',
            'google_tag_manager_id',
            'yandex_rsy_site_id',
            'yandex_rsy_block_id',
            'yandex_rsy_script',
            'custom_head_html',
            'custom_body_html',
            'landing_media_categories',
            'landing_media_carousel',
            'landing_portal_cards',
            'landing_plan_styles',
            'settings_history',
            'default_landing_category',
            'landing_default_version',
            'landing_private_reviews',
            'landing_company_reviews',
            'landing_pending_reviews',
            'landing_lead_requests',
            'landing_ai_canned_responses',
            'landing_ai_fallback_reply',
            'landing_ai_chat_logs',
            'yookassa_shop_id',
            'yookassa_secret_key',
            'yookassa_return_url',
            'has_yookassa_secret',
            'updated_at',
        ]
        read_only_fields = ['updated_at', 'has_yookassa_secret', 'settings_history']

    def get_has_yookassa_secret(self, obj):
        return bool(obj.yookassa_secret_key)

    def update(self, instance, validated_data):
        # Не перетираем secret пустой строкой, если пользователь его не трогал.
        if 'yookassa_secret_key' in validated_data and validated_data['yookassa_secret_key'] == '':
            validated_data.pop('yookassa_secret_key')
        return super().update(instance, validated_data)
