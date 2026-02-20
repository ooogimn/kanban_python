# Mind Maps initial migration

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0001_initial'),
        ('todo', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='MindMap',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255, verbose_name='Title')),
                ('nodes', models.JSONField(blank=True, default=list, verbose_name='Nodes')),
                ('edges', models.JSONField(blank=True, default=list, verbose_name='Edges')),
                ('is_personal', models.BooleanField(default=False, verbose_name='Personal')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated at')),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='mindmaps', to=settings.AUTH_USER_MODEL, verbose_name='Owner')),
                ('project', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='mindmaps', to='todo.project', verbose_name='Project')),
                ('related_workitem', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='mindmaps', to='todo.workitem', verbose_name='Related Task')),
                ('workspace', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='mindmaps', to='core.workspace', verbose_name='Workspace')),
            ],
            options={
                'verbose_name': 'Mind Map',
                'verbose_name_plural': 'Mind Maps',
                'ordering': ['-updated_at'],
            },
        ),
        migrations.AddIndex(
            model_name='mindmap',
            index=models.Index(fields=['workspace'], name='mindmaps_workspace_idx'),
        ),
        migrations.AddIndex(
            model_name='mindmap',
            index=models.Index(fields=['project'], name='mindmaps_project_idx'),
        ),
        migrations.AddIndex(
            model_name='mindmap',
            index=models.Index(fields=['related_workitem'], name='mindmaps_workitem_idx'),
        ),
        migrations.AddIndex(
            model_name='mindmap',
            index=models.Index(fields=['owner', 'is_personal'], name='mindmaps_owner_pers_idx'),
        ),
    ]
