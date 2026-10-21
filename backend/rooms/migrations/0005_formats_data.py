"""Перевод существующих комнат на новые форматы.

«Слепой» становится «Рандомом» (те же вопросы вперемешку, без категорий и бонусов).
Баллы теперь назначаются только в стратегическом формате и только от 1 до 5:
в классике и рандоме все вопросы стоят 1 балл.
"""
from django.db import migrations


def to_new_formats(apps, schema_editor):
    AORoom = apps.get_model("rooms", "AORoom")
    Question = apps.get_model("rooms", "Question")

    AORoom.objects.filter(format="blind").update(format="random")
    Question.objects.filter(room__format__in=("classic", "random")).update(points=1)
    Question.objects.filter(room__format="strategic", points__gt=5).update(points=5)
    Question.objects.filter(points__lt=1).update(points=1)


def back_to_blind(apps, schema_editor):
    # Баллы вернуть неоткуда — восстанавливаем только название формата
    apps.get_model("rooms", "AORoom").objects.filter(format="random").update(format="blind")


class Migration(migrations.Migration):
    dependencies = [("rooms", "0004_new_formats")]

    operations = [migrations.RunPython(to_new_formats, back_to_blind)]
