from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import AORoom, Like


@receiver([post_save, post_delete], sender=Like)
def recount_likes(sender, instance, **kwargs):
    """Держит AORoom.likes_count в синхроне — и из API, и из админки, и при каскадном удалении."""
    AORoom.objects.filter(pk=instance.room_id).update(
        likes_count=Like.objects.filter(room_id=instance.room_id).count()
    )
