from django.conf import settings
from django.db import models

from rooms.models import AORoom


class GameSession(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_FINISHED = "finished"
    STATUS_CHOICES = [(STATUS_ACTIVE, "Идёт"), (STATUS_FINISHED, "Завершена")]

    room = models.ForeignKey(AORoom, on_delete=models.CASCADE, related_name="sessions")
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="hosted_sessions"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "игровая сессия"
        verbose_name_plural = "игровые сессии"
        ordering = ["-created_at"]


class Team(models.Model):
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=20)
    session = models.ForeignKey(GameSession, on_delete=models.CASCADE, related_name="teams")
    score = models.IntegerField(default=0)

    class Meta:
        verbose_name = "команда"
        verbose_name_plural = "команды"
        ordering = ["id"]
