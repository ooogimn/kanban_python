import logging
from urllib.parse import quote_plus

import requests
from celery import shared_task
from django.conf import settings

from apps.blog.models import Post

logger = logging.getLogger(__name__)


def _build_post_public_url(post: Post) -> str:
    base = str(getattr(settings, 'FRONTEND_URL', '') or '').rstrip('/')
    if not base:
        return ''
    return f'{base}/blog/{post.slug}'


def _build_sitemap_public_url() -> str:
    base = str(getattr(settings, 'BACKEND_PUBLIC_URL', '') or '').rstrip('/')
    if not base:
        return ''
    return f'{base}/sitemap.xml'


@shared_task(
    name='apps.blog.tasks.trigger_search_engine_indexing',
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
)
def trigger_search_engine_indexing(post_id: int):
    post = Post.objects.filter(pk=post_id, is_published=True).first()
    if not post:
        return {'ok': False, 'reason': 'post_not_found_or_not_published'}

    post_url = _build_post_public_url(post)
    sitemap_url = _build_sitemap_public_url()

    ping_results = []

    ping_templates = list(
        getattr(
            settings,
            'SEO_SITEMAP_PING_TEMPLATES',
            [
                'https://www.google.com/ping?sitemap={sitemap}',
                'https://webmaster.yandex.ru/ping?sitemap={sitemap}',
            ],
        )
    )
    for template in ping_templates:
        if not template or not sitemap_url:
            continue
        try:
            url = str(template).replace('{sitemap}', quote_plus(sitemap_url))
            response = requests.get(url, timeout=10)
            ping_results.append({'type': 'sitemap_ping', 'url': url, 'status_code': response.status_code})
        except Exception as exc:
            ping_results.append({'type': 'sitemap_ping', 'url': str(template), 'error': str(exc)})

    indexnow_enabled = bool(getattr(settings, 'INDEXNOW_ENABLED', False))
    indexnow_key = str(getattr(settings, 'INDEXNOW_KEY', '') or '').strip()
    indexnow_host = str(getattr(settings, 'INDEXNOW_HOST', '') or '').strip()
    if indexnow_enabled and indexnow_key and indexnow_host and post_url:
        try:
            payload = {
                'host': indexnow_host,
                'key': indexnow_key,
                'urlList': [post_url],
            }
            response = requests.post('https://api.indexnow.org/indexnow', json=payload, timeout=10)
            ping_results.append({'type': 'indexnow', 'status_code': response.status_code})
        except Exception as exc:
            ping_results.append({'type': 'indexnow', 'error': str(exc)})

    logger.info('SEO indexing triggered post_id=%s results=%s', post_id, ping_results)
    return {'ok': True, 'post_id': post_id, 'results': ping_results}


@shared_task(
    name='apps.blog.tasks.autopost_to_social_media',
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
)
def autopost_to_social_media(post_id: int):
    """
    Автоматический постинг опубликованной статьи в Telegram и VK.
    """
    post = Post.objects.filter(pk=post_id, is_published=True).first()
    if not post:
        return {'ok': False, 'reason': 'post_not_found_or_not_published'}

    results = {}
    post_url = _build_post_public_url(post)

    # 1. Telegram
    if not post.posted_to_telegram:
        token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
        channel_id = getattr(settings, 'TELEGRAM_CHANNEL_ID', '')
        if token and channel_id:
            try:
                text = f"<b>{post.title}</b>\n\n{post.excerpt or ''}\n\n{post_url}"
                url = f"https://api.telegram.org/bot{token}/sendMessage"
                payload = {
                    'chat_id': channel_id,
                    'text': text,
                    'parse_mode': 'HTML',
                }
                resp = requests.post(url, json=payload, timeout=10)
                if resp.status_code == 200:
                    post.posted_to_telegram = True
                    post.save(update_fields=['posted_to_telegram'])
                    results['telegram'] = 'ok'
                else:
                    results['telegram'] = f'error: {resp.text}'
            except Exception as e:
                results['telegram'] = str(e)

    # 2. VK
    if not post.posted_to_vk:
        vk_token = getattr(settings, 'VK_API_ACCESS_TOKEN', '')
        vk_group_id = getattr(settings, 'VK_GROUP_ID', '')
        if vk_token and vk_group_id:
            try:
                # VK wall.post
                url = "https://api.vk.com/method/wall.post"
                # group_id must be negative for owner_id (posting to group wall as group)
                try:
                    owner_id = -abs(int(vk_group_id))
                except ValueError:
                    owner_id = 0

                if owner_id != 0:
                    params = {
                        'owner_id': owner_id,
                        'from_group': 1,
                        'message': f"{post.title}\n\n{post.excerpt or ''}",
                        'attachments': post_url,
                        'access_token': vk_token,
                        'v': '5.131',
                    }
                    resp = requests.post(url, data=params, timeout=10)
                    data = resp.json()
                    if 'response' in data:
                        post.posted_to_vk = True
                        post.save(update_fields=['posted_to_vk'])
                        results['vk'] = 'ok'
                    else:
                        results['vk'] = f"error: {data.get('error')}"
                else:
                    results['vk'] = 'error: invalid_group_id'
            except Exception as e:
                results['vk'] = str(e)

    logger.info('Autoposting triggered post_id=%s results=%s', post_id, results)
    return {'ok': True, 'results': results}
