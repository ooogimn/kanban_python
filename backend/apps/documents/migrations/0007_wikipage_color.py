# Add color field to WikiPage (notebook accent color)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0006_wiki_personal_and_set_null"),
    ]

    operations = [
        migrations.AddField(
            model_name="wikipage",
            name="color",
            field=models.CharField(blank=True, default="", max_length=7, verbose_name="Color"),
        ),
    ]
