# Generated for WorkItem finance fields and Project budget fields

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('kanban', '0001_initial'),
        ('todo', '0003_add_project_logo'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='budget_total',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Общий бюджет проекта', max_digits=12, null=True, verbose_name='Budget Total'),
        ),
        migrations.AddField(
            model_name='project',
            name='budget_spent',
            field=models.DecimalField(decimal_places=2, default=0, help_text='Сумма расходов по проекту', max_digits=12, verbose_name='Budget Spent'),
        ),
        migrations.AddField(
            model_name='project',
            name='budget_alert_threshold',
            field=models.IntegerField(default=80, help_text='При каком проценте израсходования уведомлять админа', verbose_name='Budget Alert Threshold (%)'),
        ),
        migrations.AddField(
            model_name='workitem',
            name='time_estimate',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Оценка времени в часах', max_digits=8, null=True, verbose_name='Time Estimate (hours)'),
        ),
        migrations.AddField(
            model_name='workitem',
            name='time_spent',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Затрачено времени в часах', max_digits=8, null=True, verbose_name='Time Spent (hours)'),
        ),
        migrations.AddField(
            model_name='workitem',
            name='cost',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Себестоимость/расход на выполнение задачи', max_digits=12, null=True, verbose_name='Cost'),
        ),
        migrations.AddField(
            model_name='workitem',
            name='price',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Цена для клиента (если отличается от cost)', max_digits=12, null=True, verbose_name='Price'),
        ),
        migrations.AddField(
            model_name='workitem',
            name='is_billable',
            field=models.BooleanField(default=True, help_text='Выставлять ли счет клиенту за эту задачу', verbose_name='Is Billable'),
        ),
        migrations.AddField(
            model_name='workitem',
            name='kanban_column',
            field=models.ForeignKey(blank=True, help_text='Текущая колонка канбана (денормализация для скорости)', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='workitems_direct', to='kanban.column', verbose_name='Kanban Column'),
        ),
    ]
