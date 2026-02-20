"""
Shared DRF router without format suffixes.
Avoids "Converter 'drf_format_suffix' is already registered" when multiple apps use routers.
"""
from rest_framework.routers import DefaultRouter


class NoFormatSuffixRouter(DefaultRouter):
    """DefaultRouter без format suffixes (.json) — предотвращает дублирование конвертера."""
    include_format_suffixes = False
