from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import AORoom, Question


@receiver([post_save, post_delete], sender=AORoom)
def recount_saves(sender, instance, **kwargs):
    """Держит AORoom.saves_count в синхроне: сохранение комнаты — это её копия.

    Пересчёт идёт по оригиналу, у копии saved_from заполнено. Обновляем через .update(),
    чтобы не уйти в рекурсию: он сигналов не шлёт.
    """
    source_id = instance.saved_from_id
    if not source_id:
        return
    AORoom.objects.filter(pk=source_id).update(
        saves_count=AORoom.objects.filter(saved_from_id=source_id).count()
    )


@receiver(post_delete, sender=Question)
def delete_question_photo(sender, instance, **kwargs):
    """Удаляет файл фото из хранилища вместе с вопросом (в т.ч. при каскадном удалении)."""
    if instance.photo:
        instance.photo.delete(save=False)
