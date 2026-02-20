# Initial marketing app: Advertisement model

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Advertisement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(help_text='Внутреннее название для админки', max_length=255, verbose_name='Title')),
                ('slot', models.CharField(choices=[('sidebar', 'Sidebar'), ('footer_col_1', 'Footer column 1'), ('footer_col_2', 'Footer column 2'), ('footer_col_3', 'Footer column 3')], max_length=32, verbose_name='Slot')),
                ('content_type', models.CharField(choices=[('image', 'Image'), ('html', 'HTML')], default='image', max_length=16, verbose_name='Content type')),
                ('image', models.ImageField(blank=True, null=True, upload_to='ads/%Y/%m/', verbose_name='Image')),
                ('html_code', models.TextField(blank=True, help_text='Используется при content_type=html', verbose_name='HTML code')),
                ('link', models.URLField(blank=True, max_length=512, verbose_name='Link')),
                ('is_active', models.BooleanField(default=True, verbose_name='Is active')),
                ('sort_order', models.PositiveSmallIntegerField(default=0, verbose_name='Sort order')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
            ],
            options={
                'verbose_name': 'Advertisement',
                'verbose_name_plural': 'Advertisements',
                'ordering': ['slot', 'sort_order', 'id'],
            },
        ),
    ]
