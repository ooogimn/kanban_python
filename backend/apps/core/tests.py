"""
Tests for core app (health check).
"""
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient


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
