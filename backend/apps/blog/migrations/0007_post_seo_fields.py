from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('blog', '0006_alter_category_options_alter_post_options_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='canonical_url',
            field=models.URLField(
                blank=True,
                default='',
                help_text='Canonical URL for duplicate-content control',
                verbose_name='Canonical URL',
            ),
        ),
        migrations.AddField(
            model_name='post',
            name='meta_description',
            field=models.CharField(
                blank=True,
                default='',
                help_text='SEO description for search snippets (fallback: excerpt)',
                max_length=320,
                verbose_name='Meta description',
            ),
        ),
        migrations.AddField(
            model_name='post',
            name='meta_title',
            field=models.CharField(
                blank=True,
                default='',
                help_text='SEO title for search engines (fallback: title)',
                max_length=255,
                verbose_name='Meta title',
            ),
        ),
        migrations.AddField(
            model_name='post',
            name='og_image',
            field=models.URLField(
                blank=True,
                default='',
                help_text='Preferred social preview image URL',
                verbose_name='OpenGraph image URL',
            ),
        ),
    ]
