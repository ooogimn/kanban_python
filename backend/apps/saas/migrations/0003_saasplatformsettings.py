from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('saas', '0002_alter_plan_limits'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SaasPlatformSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('singleton_key', models.CharField(default='default', editable=False, max_length=32, unique=True)),
                ('brand_name', models.CharField(default='AntExpress', max_length=128)),
                ('public_site_url', models.URLField(default='https://antexpress.ru', max_length=512)),
                ('yandex_webmaster_verification', models.CharField(blank=True, default='', max_length=255)),
                ('yandex_metrika_counter_id', models.CharField(blank=True, default='', max_length=64)),
                ('yandex_metrika_tag', models.TextField(blank=True, default='')),
                ('google_analytics_measurement_id', models.CharField(blank=True, default='', max_length=64)),
                ('google_tag_manager_id', models.CharField(blank=True, default='', max_length=64)),
                ('yandex_rsy_site_id', models.CharField(blank=True, default='', max_length=128)),
                ('yandex_rsy_block_id', models.CharField(blank=True, default='', max_length=128)),
                ('yandex_rsy_script', models.TextField(blank=True, default='')),
                ('custom_head_html', models.TextField(blank=True, default='')),
                ('custom_body_html', models.TextField(blank=True, default='')),
                ('yookassa_shop_id', models.CharField(blank=True, default='', max_length=128)),
                ('yookassa_secret_key', models.CharField(blank=True, default='', max_length=255)),
                ('yookassa_return_url', models.URLField(blank=True, default='', max_length=512)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'updated_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='updated_saas_platform_settings',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'verbose_name': 'SaaS platform settings',
                'verbose_name_plural': 'SaaS platform settings',
                'db_table': 'saas_platform_settings',
            },
        ),
    ]
