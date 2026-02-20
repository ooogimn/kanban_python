# HR-SPRINT 3: Invitation model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_projectmember_contact'),
        ('hr', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Invitation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(max_length=254, verbose_name='Email')),
                ('token', models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
                ('status', models.CharField(
                    choices=[('PENDING', 'Pending'), ('ACCEPTED', 'Accepted'), ('EXPIRED', 'Expired')],
                    default='PENDING',
                    max_length=20,
                    verbose_name='Status',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('expires_at', models.DateTimeField(verbose_name='Expires at')),
                ('contact', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='invitation',
                    to='hr.contact',
                    verbose_name='Contact',
                )),
                ('sender', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sent_invitations',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Sender',
                )),
                ('workspace', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='invitations',
                    to='core.workspace',
                    verbose_name='Workspace',
                )),
            ],
            options={
                'verbose_name': 'Invitation',
                'verbose_name_plural': 'Invitations',
                'db_table': 'hr_invitations',
            },
        ),
        migrations.AddIndex(
            model_name='invitation',
            index=models.Index(fields=['token'], name='hr_invitat_token_idx'),
        ),
        migrations.AddIndex(
            model_name='invitation',
            index=models.Index(fields=['email'], name='hr_invitat_email_idx'),
        ),
    ]
