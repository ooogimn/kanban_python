# Initial blog app: Post model

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Post',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255, verbose_name='Title')),
                ('slug', models.SlugField(help_text='URL-friendly identifier', max_length=255, unique=True, verbose_name='Slug')),
                ('excerpt', models.TextField(blank=True, help_text='Short summary for SEO and list previews', verbose_name='Excerpt')),
                ('content', models.TextField(help_text='Main text (Markdown supported)', verbose_name='Content')),
                ('image', models.ImageField(blank=True, null=True, upload_to='blog/%Y/%m/', verbose_name='Image')),
                ('is_published', models.BooleanField(default=False, verbose_name='Is published')),
                ('published_at', models.DateTimeField(blank=True, null=True, verbose_name='Published at')),
                ('views_count', models.PositiveIntegerField(default=0, verbose_name='Views count')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
            ],
            options={
                'verbose_name': 'Post',
                'verbose_name_plural': 'Posts',
                'ordering': ['-published_at', '-created_at'],
            },
        ),
    ]
