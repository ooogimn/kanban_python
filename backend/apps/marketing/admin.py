from django.contrib import admin
from .models import Advertisement


@admin.register(Advertisement)
class AdvertisementAdmin(admin.ModelAdmin):
    list_display = ('title', 'slot', 'content_type', 'is_active', 'sort_order')
    list_filter = ('slot', 'content_type', 'is_active')
    search_fields = ('title',)
