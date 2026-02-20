# Wiki 2.0: личные заметки, SET_NULL при удалении контейнера, уникальность (author, slug)

from django.db import migrations, models
import django.db.models.deletion
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0005_rename_wiki_pages_workspa_idx_wiki_pages_workspa_b9e2ad_idx_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="wikipage",
            name="workspace",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="wiki_pages",
                to="core.workspace",
                verbose_name="Workspace",
            ),
        ),
        migrations.AlterField(
            model_name="wikipage",
            name="project",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="wiki_pages",
                to="todo.project",
                verbose_name="Project",
            ),
        ),
        migrations.RemoveConstraint(
            model_name="wikipage",
            name="wiki_workspace_slug_uniq",
        ),
        migrations.AddConstraint(
            model_name="wikipage",
            constraint=models.UniqueConstraint(
                condition=Q(project__isnull=True, workspace__isnull=False),
                fields=("workspace", "slug"),
                name="wiki_workspace_slug_uniq",
            ),
        ),
        migrations.AddConstraint(
            model_name="wikipage",
            constraint=models.UniqueConstraint(
                condition=Q(project__isnull=True, workspace__isnull=True),
                fields=("author", "slug"),
                name="wiki_personal_slug_uniq",
            ),
        ),
    ]
