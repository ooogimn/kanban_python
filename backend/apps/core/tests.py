"""
Tests for core app (health check).
"""
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.utils import timezone

from apps.blog.models import Post


class HealthCheckTestCase(TestCase):
    """Health check endpoint."""

    def setUp(self):
        self.client = APIClient()

    def test_health_returns_200_when_db_available(self):
        """GET /api/health/ returns 200 and includes db status."""
        # Health check is mounted at api/health/ and the view is at ''
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data.get('status'), 'ok')
        self.assertIn('db', data)
        self.assertEqual(data.get('db'), 'ok')
        self.assertIn('service', data)

    def test_health_no_auth_required(self):
        """Health check does not require authentication."""
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_celery_health_endpoint_returns_200(self):
        """Celery health endpoint always responds 200 with status payload."""
        response = self.client.get('/api/health/celery/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('status', data)
        self.assertIn(data.get('status'), ['ok', 'degraded'])

    def test_robots_txt_is_available(self):
        response = self.client.get('/robots.txt')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('Sitemap:', response.content.decode('utf-8'))

    def test_sitemap_contains_published_blog_posts(self):
        Post.objects.create(
            title='SEO Post',
            slug='seo-post',
            excerpt='short',
            content='content',
            is_published=True,
            published_at=timezone.now(),
        )
        response = self.client.get('/sitemap.xml')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = response.content.decode('utf-8')
        self.assertIn('/blog/seo-post', content)
