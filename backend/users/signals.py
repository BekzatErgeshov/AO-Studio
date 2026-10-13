from django.contrib.auth import get_user_model
from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver

User = get_user_model()


@receiver(post_delete, sender=User)
def delete_avatar_file(sender, instance, **kwargs):
    """Удаляет файл аватара из хранилища вместе с пользователем."""
    if instance.avatar:
        instance.avatar.delete(save=False)


@receiver(pre_save, sender=User)
def delete_replaced_avatar(sender, instance, **kwargs):
    """При смене аватара удаляет старый файл."""
    if not instance.pk:
        return
    old = User.objects.filter(pk=instance.pk).values_list("avatar", flat=True).first()
    if old and old != (instance.avatar.name if instance.avatar else ""):
        instance.avatar.storage.delete(old)
