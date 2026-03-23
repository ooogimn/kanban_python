from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.models import SocialIdentity

User = get_user_model()


TEST_SOCIAL_PROVIDERS = {
    'google': {
        'enabled': True,
        'client_id': 'test-google-client',
        'client_secret': 'test-google-secret',
        'authorize_url': 'https://accounts.google.com/o/oauth2/v2/auth',
        'token_url': 'https://oauth2.googleapis.com/token',
        'scopes': ['openid', 'email', 'profile'],
        'use_nonce': True,
    },
    'yandex': {'enabled': False, 'client_id': '', 'client_secret': ''},
    'vk': {'enabled': False, 'client_id': '', 'client_secret': ''},
    'mail': {'enabled': False, 'client_id': '', 'client_secret': ''},
    'telegram': {'enabled': True, 'client_id': 'tg_bot', 'client_secret': 'tg_token'},
}


@override_settings(
    FRONTEND_URL='http://localhost:3000',
    BACKEND_PUBLIC_URL='http://localhost:8000',
    SOCIAL_AUTH_PROVIDERS=TEST_SOCIAL_PROVIDERS,
    SOCIAL_AUTH_ALLOWED_FRONTEND_PATHS=['/login', '/register'],
)
class SocialAuthApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_social_start_returns_auth_url(self):
        response = self.client.get('/api/v1/auth/social/google/start/?next=/login')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('auth_url', data)
        self.assertIn('state=', data['auth_url'])

    @patch('apps.auth.social_views.requests.get')
    @patch('apps.auth.social_views.requests.post')
    def test_social_exchange_creates_user_and_identity(self, mock_post, mock_get):
        start = self.client.get('/api/v1/auth/social/google/start/?next=/login')
        state = start.json()['state']

        token_resp = Mock()
        token_resp.raise_for_status = Mock()
        token_resp.json.return_value = {'access_token': 'g_token'}
        mock_post.return_value = token_resp

        profile_resp = Mock()
        profile_resp.raise_for_status = Mock()
        profile_resp.json.return_value = {
            'sub': 'google-sub-123',
            'email': 'social@example.com',
            'email_verified': True,
            'given_name': 'Soc',
            'family_name': 'User',
        }
        mock_get.return_value = profile_resp

        response = self.client.post(
            '/api/v1/auth/social/google/exchange/',
            {'code': 'oauth-code', 'state': state},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['auth_provider'], 'google')
        self.assertTrue(data['is_new_user'])
        self.assertIn('access', data)
        self.assertIn('refresh', data)
        self.assertTrue(User.objects.filter(email='social@example.com').exists())
        self.assertTrue(
            SocialIdentity.objects.filter(provider='google', provider_user_id='google-sub-123').exists()
        )

    @patch('apps.auth.social_views.requests.get')
    @patch('apps.auth.social_views.requests.post')
    def test_social_exchange_merges_existing_verified_email(self, mock_post, mock_get):
        existing = User.objects.create_user(
            username='existing',
            email='same@example.com',
            password='strongpass123',
        )
        start = self.client.get('/api/v1/auth/social/google/start/?next=/login')
        state = start.json()['state']

        token_resp = Mock()
        token_resp.raise_for_status = Mock()
        token_resp.json.return_value = {'access_token': 'g_token'}
        mock_post.return_value = token_resp

        profile_resp = Mock()
        profile_resp.raise_for_status = Mock()
        profile_resp.json.return_value = {
            'sub': 'google-sub-merge',
            'email': 'same@example.com',
            'email_verified': True,
        }
        mock_get.return_value = profile_resp

        response = self.client.post(
            '/api/v1/auth/social/google/exchange/',
            {'code': 'oauth-code', 'state': state},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['user']['id'], existing.id)
        self.assertFalse(payload['is_new_user'])


class PasswordHybridFlowTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='social_only',
            email='social_only@example.com',
            password='',
        )
        self.user.set_unusable_password()
        self.user.save(update_fields=['password'])
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_has_password_false_then_true_after_set(self):
        has_before = self.client.get('/api/v1/auth/password/has/')
        self.assertEqual(has_before.status_code, status.HTTP_200_OK)
        self.assertFalse(has_before.json()['has_password'])

        set_resp = self.client.post(
            '/api/v1/auth/password/set/',
            {'new_password': 'newstrongpassword123'},
            format='json',
        )
        self.assertEqual(set_resp.status_code, status.HTTP_200_OK)

        has_after = self.client.get('/api/v1/auth/password/has/')
        self.assertEqual(has_after.status_code, status.HTTP_200_OK)
        self.assertTrue(has_after.json()['has_password'])
