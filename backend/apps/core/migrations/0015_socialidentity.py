from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0014_ensure_personal_project_and_reassign'),
    ]

    operations = [
        migrations.CreateModel(
            name='SocialIdentity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(choices=[('google', 'Google'), ('yandex', 'Yandex'), ('telegram', 'Telegram'), ('vk', 'VK'), ('mail', 'Mail')], max_length=32, verbose_name='Provider')),
                ('provider_user_id', models.CharField(max_length=255, verbose_name='Provider user id')),
                ('email', models.EmailField(blank=True, max_length=254, null=True, verbose_name='Email')),
                ('is_email_verified', models.BooleanField(default=False, verbose_name='Is email verified')),
                ('raw_profile', models.JSONField(blank=True, default=dict, verbose_name='Raw provider profile')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='social_identities', to=settings.AUTH_USER_MODEL, verbose_name='User')),
            ],
            options={
                'verbose_name': 'Social identity',
                'verbose_name_plural': 'Social identities',
                'db_table': 'social_identities',
            },
        ),
        migrations.AddConstraint(
            model_name='socialidentity',
            constraint=models.UniqueConstraint(fields=('provider', 'provider_user_id'), name='unique_social_provider_uid'),
        ),
        migrations.AddIndex(
            model_name='socialidentity',
            index=models.Index(fields=['provider', 'email'], name='social_ident_provider_2262bc_idx'),
        ),
        migrations.AddIndex(
            model_name='socialidentity',
            index=models.Index(fields=['user'], name='social_ident_user_id_18fbe7_idx'),
        ),
    ]
