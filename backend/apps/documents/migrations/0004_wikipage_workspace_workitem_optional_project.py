# Generated manually for notes without project / link to task

from django.db import migrations, models
import django.db.models.deletion
from django.db.models import Q


def backfill_wiki_workspace(apps, schema_editor):
    WikiPage = apps.get_model('documents', 'WikiPage')
    for page in WikiPage.objects.filter(project__isnull=False).select_related('project'):
        page.workspace_id = page.project.workspace_id
        page.save(update_fields=['workspace_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        ('documents', '0003_wikipage_attachment_content_type_and_more'),
        ('todo', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='wikipage',
            name='workspace',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='wiki_pages',
                to='core.workspace',
                verbose_name='Workspace',
            ),
        ),
        migrations.AddField(
            model_name='wikipage',
            name='workitem',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='linked_wiki_pages',
                to='todo.workitem',
                verbose_name='Linked Task',
            ),
        ),
        migrations.AlterField(
            model_name='wikipage',
            name='project',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='wiki_pages',
                to='todo.project',
                verbose_name='Project',
            ),
        ),
        migrations.RunPython(backfill_wiki_workspace, migrations.RunPython.noop),
        migrations.AlterUniqueTogether(
            name='wikipage',
            unique_together=set(),
        ),
        migrations.AddConstraint(
            model_name='wikipage',
            constraint=models.UniqueConstraint(
                condition=Q(project__isnull=True),
                fields=('workspace', 'slug'),
                name='wiki_workspace_slug_uniq',
            ),
        ),
        migrations.AddConstraint(
            model_name='wikipage',
            constraint=models.UniqueConstraint(
                condition=Q(project__isnull=False),
                fields=('project', 'slug'),
                name='wiki_project_slug_uniq',
            ),
        ),
        migrations.AddIndex(
            model_name='wikipage',
            index=models.Index(fields=['workspace'], name='wiki_pages_workspa_idx'),
        ),
        migrations.AddIndex(
            model_name='wikipage',
            index=models.Index(fields=['workitem'], name='wiki_pages_workite_idx'),
        ),
    ]
