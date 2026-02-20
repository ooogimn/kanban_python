# Generated manually for Note/Comment -> Task

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contenttypes', '0002_remove_content_type_name'),
        ('todo', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='workitem',
            name='source_content_type',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='workitem_sources',
                to='contenttypes.contenttype',
                verbose_name='Source Content Type'
            ),
        ),
        migrations.AddField(
            model_name='workitem',
            name='source_object_id',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Source Object ID'),
        ),
        migrations.AddIndex(
            model_name='workitem',
            index=models.Index(
                fields=['source_content_type', 'source_object_id'],
                name='work_items_source__a1b2c3_idx'
            ),
        ),
    ]
