from unittest.mock import patch, Mock

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.blog.models import Post
from apps.blog.tasks import trigger_search_engine_indexing


class BlogSeoFieldsApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_post_detail_exposes_seo_fields(self):
        post = Post.objects.create(
            title='SEO API Post',
            slug='seo-api-post',
            excerpt='excerpt',
            content='content',
            is_published=True,
            published_at=timezone.now(),
            meta_title='Custom Meta Title',
            meta_description='Custom Meta Description',
            canonical_url='https://example.com/blog/seo-api-post',
            og_image='https://example.com/media/seo.png',
        )
        response = self.client.get(f'/api/v1/blog/posts/{post.slug}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body.get('meta_title'), 'Custom Meta Title')
        self.assertEqual(body.get('meta_description'), 'Custom Meta Description')
        self.assertEqual(body.get('canonical_url'), 'https://example.com/blog/seo-api-post')
        self.assertEqual(body.get('og_image'), 'https://example.com/media/seo.png')

    @patch('apps.blog.signals.trigger_search_engine_indexing.delay')
    def test_signal_triggers_indexing_on_create_published_post(self, mock_delay):
        Post.objects.create(
            title='Published immediately',
            slug='published-immediately',
            excerpt='excerpt',
            content='content',
            is_published=True,
            published_at=timezone.now(),
        )
        mock_delay.assert_called_once()

    @patch('apps.blog.signals.trigger_search_engine_indexing.delay')
    def test_signal_triggers_indexing_when_post_becomes_published(self, mock_delay):
        post = Post.objects.create(
            title='Draft post',
            slug='draft-post',
            excerpt='excerpt',
            content='content',
            is_published=False,
        )
        mock_delay.assert_not_called()
        post.is_published = True
        post.published_at = timezone.now()
        post.save(update_fields=['is_published', 'published_at', 'updated_at'])
        mock_delay.assert_called_once_with(post.id)

    @patch('apps.blog.tasks.requests.post')
    @patch('apps.blog.tasks.requests.get')
    def test_trigger_search_engine_indexing_task_runs_pings(self, mock_get, mock_post):
        post = Post.objects.create(
            title='Index me',
            slug='index-me',
            excerpt='excerpt',
            content='content',
            is_published=True,
            published_at=timezone.now(),
        )
        get_resp = Mock()
        get_resp.status_code = 200
        mock_get.return_value = get_resp
        post_resp = Mock()
        post_resp.status_code = 200
        mock_post.return_value = post_resp

        with self.settings(
            FRONTEND_URL='https://example.com',
            BACKEND_PUBLIC_URL='https://api.example.com',
            SEO_SITEMAP_PING_TEMPLATES=['https://ping.example.com/?sitemap={sitemap}'],
            INDEXNOW_ENABLED=True,
            INDEXNOW_KEY='index-key',
            INDEXNOW_HOST='example.com',
        ):
            result = trigger_search_engine_indexing(post.id)
        self.assertTrue(result.get('ok'))
        self.assertGreaterEqual(len(result.get('results', [])), 2)
