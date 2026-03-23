from django.contrib.sitemaps import Sitemap
from django.utils import timezone

from apps.blog.models import Post


class BlogPostSitemap(Sitemap):
    changefreq = 'daily'
    priority = 0.8

    def items(self):
        return Post.objects.filter(
            is_published=True,
            published_at__isnull=False,
            published_at__lte=timezone.now(),
        ).order_by('-published_at')

    def lastmod(self, obj):
        return obj.updated_at or obj.published_at

    def location(self, obj):
        return f'/blog/{obj.slug}'
