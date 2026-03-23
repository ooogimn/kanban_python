"""
Celery configuration for Office Suite 360.
"""
import os
import logging
from celery import Celery
from celery.signals import task_failure, task_retry

logger = logging.getLogger(__name__)

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('config')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')


@task_failure.connect
def on_celery_task_failure(sender=None, task_id=None, exception=None, args=None, kwargs=None, traceback=None, einfo=None, **extra):
    task_name = getattr(sender, 'name', '') or ''
    is_billing_task = task_name.startswith('apps.billing.')
    logger.error(
        'celery_task_failure task=%s id=%s exception=%s args=%s kwargs=%s',
        task_name,
        task_id,
        exception,
        args,
        kwargs,
        exc_info=exception,
    )
    if is_billing_task:
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(exception)
        except Exception:
            pass


@task_retry.connect
def on_celery_task_retry(sender=None, request=None, reason=None, einfo=None, **extra):
    task_name = getattr(sender, 'name', '') or ''
    is_billing_task = task_name.startswith('apps.billing.')
    logger.warning(
        'celery_task_retry task=%s id=%s reason=%s retries=%s',
        task_name,
        getattr(request, 'id', None),
        reason,
        getattr(request, 'retries', None),
    )
    if is_billing_task:
        try:
            import sentry_sdk
            with sentry_sdk.push_scope() as scope:
                scope.set_tag('celery.task', task_name)
                scope.set_tag('celery.retry', True)
                scope.set_extra('task_id', getattr(request, 'id', None))
                scope.set_extra('retries', getattr(request, 'retries', None))
                sentry_sdk.capture_message(f'Billing task retry: {task_name}', level='warning')
        except Exception:
            pass
