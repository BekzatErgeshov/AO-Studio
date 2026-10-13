from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField("email", unique=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Идентификатор аккаунта Google (поле `sub` в токене) — для входа через Google
    google_sub = models.CharField(max_length=64, unique=True, null=True, blank=True, editable=False)

    class Meta:
        verbose_name = "пользователь"
        verbose_name_plural = "пользователи"

    def __str__(self):
        return self.username
