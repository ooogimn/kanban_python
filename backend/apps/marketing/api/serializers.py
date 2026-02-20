from rest_framework import serializers
from apps.marketing.models import Advertisement


class AdvertisementSerializer(serializers.ModelSerializer):
    """Сериализатор для публичного API объявлений."""

    image_url = serializers.SerializerMethodField(read_only=True)
    video_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Advertisement
        fields = (
            'id', 'title', 'slot', 'content_type', 'image', 'image_url',
            'video', 'video_url', 'html_code', 'link', 'width', 'height',
        )

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url

    def get_video_url(self, obj):
        if not obj.video:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.video.url)
        return obj.video.url
