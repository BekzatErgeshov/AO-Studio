from datetime import timedelta

from django import template
from django.contrib.auth import get_user_model
from django.utils import timezone

from game.models import GameSession
from rooms.models import AORoom, Question

register = template.Library()


@register.inclusion_tag("admin/ao_stats.html")
def ao_stats():
    """Карточки статистики на главной странице админки."""
    User = get_user_model()
    week_ago = timezone.now() - timedelta(days=7)
    return {
        "cards": [
            {"label": "Пользователей", "value": User.objects.count(),
             "sub": f"+{User.objects.filter(created_at__gte=week_ago).count()} за неделю",
             "icon": "fas fa-user", "url": "admin:users_user_changelist"},
            {"label": "AO комнат", "value": AORoom.objects.count(),
             "sub": f"публичных: {AORoom.objects.filter(is_public=True).count()}",
             "icon": "fas fa-gamepad", "url": "admin:rooms_aoroom_changelist"},
            {"label": "Вопросов", "value": Question.objects.count(),
             "sub": f"сохранений: {AORoom.objects.filter(saved_from__isnull=False).count()}",
             "icon": "fas fa-question-circle", "url": "admin:rooms_question_changelist"},
            {"label": "Игр сыграно", "value": GameSession.objects.count(),
             "sub": f"завершено: {GameSession.objects.filter(status='finished').count()}",
             "icon": "fas fa-trophy", "url": "admin:game_gamesession_changelist"},
        ]
    }
