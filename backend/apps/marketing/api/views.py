"""
Публичный API рекламы — GET /api/v1/marketing/ads/ с группировкой по слотам.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from uuid import uuid4

from apps.marketing.models import Advertisement
from apps.saas.models import SaasPlatformSettings, Plan
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


@api_view(['GET'])
@permission_classes([AllowAny])
def public_settings(request):
    """
    Публичные настройки для встраивания аналитики/маркетинга на фронтенде.
    Без секретов (secret keys не отдаются).
    """
    cfg = SaasPlatformSettings.get_solo()
    plans = (
        Plan.objects.filter(is_active=True)
        .order_by('price', 'id')
        .values('id', 'name', 'price', 'currency', 'limits', 'is_default')
    )
    landing_plans = []
    for p in plans:
        limits = p.get('limits') or {}
        landing_plans.append(
            {
                'id': p['id'],
                'name': p.get('name') or '',
                'price': str(p.get('price') or '0'),
                'currency': p.get('currency') or 'RUB',
                'limits': limits if isinstance(limits, dict) else {},
                'is_default': bool(p.get('is_default')),
            }
        )

    return Response(
        {
            'brand_name': cfg.brand_name or '',
            'public_site_url': cfg.public_site_url or '',
            'yandex_webmaster_verification': cfg.yandex_webmaster_verification or '',
            'yandex_metrika_counter_id': cfg.yandex_metrika_counter_id or '',
            'yandex_metrika_tag': cfg.yandex_metrika_tag or '',
            'google_analytics_measurement_id': cfg.google_analytics_measurement_id or '',
            'google_tag_manager_id': cfg.google_tag_manager_id or '',
            'yandex_rsy_site_id': cfg.yandex_rsy_site_id or '',
            'yandex_rsy_block_id': cfg.yandex_rsy_block_id or '',
            'yandex_rsy_script': cfg.yandex_rsy_script or '',
            'custom_head_html': cfg.custom_head_html or '',
            'custom_body_html': cfg.custom_body_html or '',
            'landing_media_categories': cfg.landing_media_categories or [],
            'landing_media_carousel': cfg.landing_media_carousel or [],
            'landing_portal_cards': cfg.landing_portal_cards or [],
            'landing_plan_styles': cfg.landing_plan_styles or [],
            'default_landing_category': cfg.default_landing_category or '',
            'landing_default_version': cfg.landing_default_version or 'v2',
            'landing_private_reviews': cfg.landing_private_reviews or [],
            'landing_company_reviews': cfg.landing_company_reviews or [],
            'landing_ai_canned_responses': cfg.landing_ai_canned_responses or [],
            'landing_ai_fallback_reply': cfg.landing_ai_fallback_reply or '',
            'landing_plans': landing_plans,
        }
    )


def _notify_admin(subject: str, message: str) -> None:
    recipients = []
    env_recipient = getattr(settings, 'EMAIL_HOST_USER', '') or ''
    if env_recipient:
        recipients.append(env_recipient)
    if not recipients:
        return
    send_mail(
        subject=subject,
        message=message,
        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
        recipient_list=recipients,
        fail_silently=True,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def submit_lead(request):
    cfg = SaasPlatformSettings.get_solo()
    payload = request.data if isinstance(request.data, dict) else {}

    name = str(payload.get('name') or '').strip()
    contact = str(payload.get('contact') or '').strip()
    message = str(payload.get('message') or '').strip()
    source = str(payload.get('source') or 'landing').strip() or 'landing'

    if not name or not contact:
        return Response({'detail': 'name and contact are required'}, status=400)

    leads = cfg.landing_lead_requests or []
    leads.append(
        {
            'id': timezone.now().strftime('%Y%m%d%H%M%S%f'),
            'name': name,
            'contact': contact,
            'message': message,
            'source': source,
            'user_id': request.user.id if getattr(request, 'user', None) and request.user.is_authenticated else None,
            'user_username': request.user.username if getattr(request, 'user', None) and request.user.is_authenticated else '',
            'status': 'new',
            'created_at': timezone.now().isoformat(),
        }
    )
    cfg.landing_lead_requests = leads[-500:]
    cfg.save(update_fields=['landing_lead_requests', 'updated_at'])

    _notify_admin(
        'Новая заявка с лендинга',
        f'Имя: {name}\nКонтакт: {contact}\nИсточник: {source}\nСообщение: {message}',
    )
    return Response({'ok': True}, status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def submit_review(request):
    cfg = SaasPlatformSettings.get_solo()
    payload = request.data if isinstance(request.data, dict) else {}

    review_type = str(payload.get('review_type') or 'private').strip().lower()
    if review_type not in ('private', 'company'):
        review_type = 'private'

    author = str(payload.get('author') or '').strip()
    text = str(payload.get('text') or '').strip()
    company = str(payload.get('company') or '').strip()
    avatar_or_logo = str(payload.get('avatar_or_logo') or '').strip()

    if not text:
        return Response({'detail': 'text is required'}, status=400)
    if review_type == 'private' and not author:
        return Response({'detail': 'author is required for private review'}, status=400)
    if review_type == 'company' and not company:
        return Response({'detail': 'company is required for company review'}, status=400)

    pending = cfg.landing_pending_reviews or []
    pending.append(
        {
            'id': timezone.now().strftime('%Y%m%d%H%M%S%f'),
            'review_type': review_type,
            'author': author,
            'company': company,
            'text': text,
            'avatar_or_logo': avatar_or_logo,
            'user_id': request.user.id if getattr(request, 'user', None) and request.user.is_authenticated else None,
            'user_username': request.user.username if getattr(request, 'user', None) and request.user.is_authenticated else '',
            'status': 'draft',
            'created_at': timezone.now().isoformat(),
        }
    )
    cfg.landing_pending_reviews = pending[-500:]
    cfg.save(update_fields=['landing_pending_reviews', 'updated_at'])

    _notify_admin(
        'Новый отзыв на модерацию',
        f'Тип: {review_type}\nАвтор: {author}\nКомпания: {company}\nТекст: {text}',
    )
    return Response({'ok': True}, status=201)


def _normalize_text(text: str) -> str:
    return ' '.join(str(text or '').lower().strip().split())


def _build_chat_reply(cfg: SaasPlatformSettings, message: str, request) -> tuple[str, bool]:
    normalized = _normalize_text(message)
    matched_answer = ''
    matched = False
    for row in (cfg.landing_ai_canned_responses or []):
        keywords = row.get('keywords') if isinstance(row, dict) else []
        answer = row.get('answer') if isinstance(row, dict) else ''
        if not isinstance(keywords, list) or not answer:
            continue
        keys = [_normalize_text(k) for k in keywords if str(k or '').strip()]
        if keys and any(k in normalized for k in keys):
            matched_answer = str(answer).strip()
            matched = True
            break

    reply = matched_answer or (cfg.landing_ai_fallback_reply or '').strip() or 'Я принял ваш вопрос и передал его команде.'
    auth = getattr(request, 'user', None) and request.user.is_authenticated
    if any(k in normalized for k in ('оплат', 'тариф', 'подписк')):
        if auth:
            reply += '\n\nДля оплаты и выбора тарифа откройте: /account/upgrade'
        else:
            reply += '\n\nДля оплаты сначала выполните вход или регистрацию.'
    return reply, matched


def _append_chat_log(cfg: SaasPlatformSettings, item: dict):
    logs = cfg.landing_ai_chat_logs or []
    logs.append(item)
    cfg.landing_ai_chat_logs = logs[-3000:]
    cfg.save(update_fields=['landing_ai_chat_logs', 'updated_at'])


@api_view(['POST'])
@permission_classes([AllowAny])
def chat_reply(request):
    cfg = SaasPlatformSettings.get_solo()
    payload = request.data if isinstance(request.data, dict) else {}
    text = str(payload.get('message') or '').strip()
    if not text:
        return Response({'detail': 'message is required'}, status=400)

    session_id = str(payload.get('session_id') or '').strip() or uuid4().hex
    reply, matched = _build_chat_reply(cfg, text, request)
    now = timezone.now().isoformat()
    user_id = request.user.id if getattr(request, 'user', None) and request.user.is_authenticated else None
    username = request.user.username if getattr(request, 'user', None) and request.user.is_authenticated else ''

    _append_chat_log(
        cfg,
        {
            'id': uuid4().hex,
            'session_id': session_id,
            'role': 'user',
            'message': text,
            'created_at': now,
            'user_id': user_id,
            'user_username': username,
        },
    )
    _append_chat_log(
        cfg,
        {
            'id': uuid4().hex,
            'session_id': session_id,
            'role': 'assistant',
            'message': reply,
            'created_at': now,
            'matched_canned': matched,
            'user_id': user_id,
            'user_username': username,
        },
    )

    return Response(
        {
            'session_id': session_id,
            'assistant_message': reply,
            'matched_canned': matched,
        }
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def chat_history(request):
    cfg = SaasPlatformSettings.get_solo()
    session_id = str(request.query_params.get('session_id') or '').strip()
    if not session_id:
        return Response({'messages': []})
    logs = [
        x
        for x in (cfg.landing_ai_chat_logs or [])
        if str(x.get('session_id') or '') == session_id
    ]
    logs = sorted(logs, key=lambda x: str(x.get('created_at') or ''))[-50:]
    return Response({'messages': logs})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_requests(request):
    cfg = SaasPlatformSettings.get_solo()
    uid = request.user.id

    leads = [
        item
        for item in (cfg.landing_lead_requests or [])
        if item.get('user_id') == uid
    ]
    reviews = [
        item
        for item in (cfg.landing_pending_reviews or [])
        if item.get('user_id') == uid
    ]
    chats = [
        item
        for item in (cfg.landing_ai_chat_logs or [])
        if item.get('user_id') == uid
    ]
    leads = sorted(leads, key=lambda x: str(x.get('created_at') or ''), reverse=True)
    reviews = sorted(reviews, key=lambda x: str(x.get('created_at') or ''), reverse=True)
    chats = sorted(chats, key=lambda x: str(x.get('created_at') or ''), reverse=True)
    return Response({'leads': leads, 'reviews': reviews, 'chats': chats})
