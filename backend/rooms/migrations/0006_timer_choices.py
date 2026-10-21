"""Время на вопрос теперь выбирается из 30, 45 или 60 секунд.

Комнаты с другим значением приводим к ближайшему допустимому, иначе их нельзя
будет сохранить при редактировании.
"""
from django.db import migrations

ALLOWED = (30, 45, 60)


def clamp_timers(apps, schema_editor):
    AORoom = apps.get_model("rooms", "AORoom")
    for room in AORoom.objects.exclude(timer_duration__in=ALLOWED).only("id", "timer_duration"):
        room.timer_duration = min(ALLOWED, key=lambda t: abs(t - room.timer_duration))
        room.save(update_fields=["timer_duration"])


class Migration(migrations.Migration):
    dependencies = [("rooms", "0005_formats_data")]

    operations = [migrations.RunPython(clamp_timers, migrations.RunPython.noop)]
