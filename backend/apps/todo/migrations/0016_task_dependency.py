# Generated manually for STEP 4: Smart Gantt (TaskDependency)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('todo', '0015_checklist_item'),
    ]

    operations = [
        migrations.CreateModel(
            name='TaskDependency',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(choices=[('FS', 'Finish-to-Start'), ('SS', 'Start-to-Start'), ('FF', 'Finish-to-Finish'), ('SF', 'Start-to-Finish')], default='FS', max_length=2, verbose_name='Type')),
                ('lag_days', models.IntegerField(default=0, verbose_name='Lag (days)')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created at')),
                ('predecessor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='successors', to='todo.workitem', verbose_name='Predecessor')),
                ('successor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='predecessors', to='todo.workitem', verbose_name='Successor')),
            ],
            options={
                'verbose_name': 'Task Dependency',
                'verbose_name_plural': 'Task Dependencies',
                'db_table': 'task_dependencies',
            },
        ),
        migrations.AddIndex(
            model_name='taskdependency',
            index=models.Index(fields=['predecessor', 'successor'], name='task_depen_predece_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='taskdependency',
            unique_together={('predecessor', 'successor')},
        ),
    ]
