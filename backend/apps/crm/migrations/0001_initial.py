# Generated for CRM - Company model

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Company',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='Полное наименование организации', max_length=255, verbose_name='Company Name')),
                ('short_name', models.CharField(blank=True, help_text='Краткое наименование', max_length=100, verbose_name='Short Name')),
                ('type', models.CharField(choices=[('client', 'Client'), ('contractor', 'Contractor'), ('partner', 'Partner'), ('supplier', 'Supplier')], default='client', max_length=20, verbose_name='Type')),
                ('logo', models.ImageField(blank=True, null=True, upload_to='crm/companies/logos/', verbose_name='Logo')),
                ('inn', models.CharField(blank=True, help_text='ИНН организации (10 или 12 цифр)', max_length=12, verbose_name='INN')),
                ('kpp', models.CharField(blank=True, help_text='КПП организации', max_length=9, verbose_name='KPP')),
                ('ogrn', models.CharField(blank=True, help_text='ОГРН / ОГРНИП', max_length=15, verbose_name='OGRN')),
                ('legal_address', models.TextField(blank=True, help_text='Юридический адрес', verbose_name='Legal Address')),
                ('actual_address', models.TextField(blank=True, help_text='Фактический адрес', verbose_name='Actual Address')),
                ('bank_name', models.CharField(blank=True, max_length=255, verbose_name='Bank Name')),
                ('bank_bik', models.CharField(blank=True, max_length=9, verbose_name='BIK')),
                ('bank_account', models.CharField(blank=True, help_text='Расчётный счёт', max_length=20, verbose_name='Account Number')),
                ('bank_corr_account', models.CharField(blank=True, help_text='Корреспондентский счёт', max_length=20, verbose_name='Correspondent Account')),
                ('email', models.EmailField(blank=True, max_length=254, verbose_name='Email')),
                ('phone', models.CharField(blank=True, max_length=20, verbose_name='Phone')),
                ('website', models.URLField(blank=True, verbose_name='Website')),
                ('description', models.TextField(blank=True, help_text='Примечания, особенности работы', verbose_name='Description')),
                ('is_active', models.BooleanField(default=True, verbose_name='Is Active')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Company',
                'verbose_name_plural': 'Companies',
                'db_table': 'companies',
                'ordering': ['name'],
            },
        ),
        migrations.AddIndex(
            model_name='company',
            index=models.Index(fields=['inn'], name='companies_inn_idx'),
        ),
        migrations.AddIndex(
            model_name='company',
            index=models.Index(fields=['type', 'is_active'], name='companies_type_idx'),
        ),
        migrations.AddIndex(
            model_name='company',
            index=models.Index(fields=['name'], name='companies_name_idx'),
        ),
    ]
