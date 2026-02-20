# Column.color для Imperial Illumination

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('kanban', '0004_alter_stage_options_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='column',
            name='color',
            field=models.CharField(
                default='#fbbf24',
                help_text='Hex color for column (Imperial Illumination)',
                max_length=7,
                verbose_name='Color',
            ),
        ),
    ]
