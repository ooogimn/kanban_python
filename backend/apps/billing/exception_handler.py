from rest_framework.views import exception_handler as drf_exception_handler

from .exceptions import FeatureLocked, QuotaExceeded


def billing_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return response

    if isinstance(exc, QuotaExceeded):
        response.data = {
            'code': exc.default_code,
            'detail': str(exc.detail),
            'limit': exc.limit,
            'usage': exc.usage,
            'metric': exc.metric,
        }
        return response

    if isinstance(exc, FeatureLocked):
        response.data = {
            'code': exc.default_code,
            'detail': str(exc.detail),
            'feature': exc.feature,
        }
        return response

    return response
