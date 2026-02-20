"""
Публичный API рекламы — GET /api/v1/marketing/ads/ с группировкой по слотам.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.marketing.models import Advertisement
from .serializers import AdvertisementSerializer


SLOTS = [
    Advertisement.SLOT_SIDEBAR,
    Advertisement.SLOT_FOOTER_COL_1,
    Advertisement.SLOT_FOOTER_COL_2,
    Advertisement.SLOT_FOOTER_COL_3,
    Advertisement.SLOT_BLOG_CONTENT,
]


@api_view(['GET'])
@permission_classes([AllowAny])
def ads_grouped(request):
    """
    GET /api/v1/marketing/ads/
    Ответ: { "sidebar": [...], "footer_col_1": [...], "footer_col_2": [], "footer_col_3": [], "blog_content": [] }
    """
    qs = Advertisement.objects.filter(is_active=True)
    serializer = AdvertisementSerializer(qs, many=True, context={'request': request})
    data = list(serializer.data)
    result = {slot: [] for slot in SLOTS}
    for item in data:
        slot = item.get('slot')
        if slot in result:
            result[slot].append(item)
    return Response(result)
