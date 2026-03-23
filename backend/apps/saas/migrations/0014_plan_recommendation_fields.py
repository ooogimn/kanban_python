from django.db import migrations, models


def normalize_plan_flags(apps, schema_editor):
    Plan = apps.get_model('saas', 'Plan')
    plans = list(Plan.objects.all().order_by('id'))
    if not plans:
        return

    # Гарантируем ровно один default-план.
    defaults = [p for p in plans if p.is_default]
    if not defaults:
        first = plans[0]
        first.is_default = True
        first.save(update_fields=['is_default', 'updated_at'])
    elif len(defaults) > 1:
        keep_id = defaults[0].id
        Plan.objects.filter(is_default=True).exclude(pk=keep_id).update(is_default=False)

    # Нормализация маркетинговых полей.
    for plan in plans:
        badge = (plan.recommended_badge or '').strip()
        note = (plan.recommended_note or '').strip()
        if plan.is_recommended:
            if not badge:
                badge = 'РЕКОМЕНДОВАН'
        else:
            badge = ''
            note = ''
        if badge != (plan.recommended_badge or '') or note != (plan.recommended_note or ''):
            plan.recommended_badge = badge
            plan.recommended_note = note
            plan.save(update_fields=['recommended_badge', 'recommended_note', 'updated_at'])


def reverse_normalize_plan_flags(apps, schema_editor):
    Plan = apps.get_model('saas', 'Plan')
    Plan.objects.filter(is_recommended=False).update(recommended_badge='', recommended_note='')


class Migration(migrations.Migration):

    dependencies = [
        ('saas', '0013_limits_unlimited_marker'),
    ]

    operations = [
        migrations.AddField(
            model_name='plan',
            name='is_recommended',
            field=models.BooleanField(
                default=False,
                help_text='Маркетинговая отметка для лендинга и карточек тарифов',
                verbose_name='Recommended plan',
            ),
        ),
        migrations.AddField(
            model_name='plan',
            name='recommended_badge',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Короткая подпись бейджа, например: РЕКОМЕНДОВАН, ЗВЕЗДА, MEDAL',
                max_length=64,
                verbose_name='Recommended badge',
            ),
        ),
        migrations.AddField(
            model_name='plan',
            name='recommended_note',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Дополнительный текст под бейджем, например: для студентов',
                max_length=160,
                verbose_name='Recommended note',
            ),
        ),
        migrations.RunPython(normalize_plan_flags, reverse_normalize_plan_flags),
    ]
