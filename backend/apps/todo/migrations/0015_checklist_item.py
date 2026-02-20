# STEP 3.5 — ChecklistItem: подзадачи для WorkItem (прогресс и статус)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('todo', '0014_workitem_color'),
    ]

    operations = [
        migrations.CreateModel(
            name='ChecklistItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=500, verbose_name='Title')),
                ('is_done', models.BooleanField(default=False, verbose_name='Is Done')),
                ('sort_order', models.IntegerField(default=0, verbose_name='Sort Order')),
                ('workitem', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='checklist_items',
                    to='todo.workitem',
                    verbose_name='Work Item',
                )),
            ],
            options={
                'verbose_name': 'Checklist Item',
                'verbose_name_plural': 'Checklist Items',
                'db_table': 'checklist_items',
                'ordering': ['sort_order', 'id'],
            },
        ),
        migrations.AddIndex(
            model_name='checklistitem',
            index=models.Index(fields=['workitem'], name='checklist_i_workite_idx'),
        ),
    ]
