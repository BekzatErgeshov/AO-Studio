from django.contrib import admin
from django.utils.html import format_html

from .models import Answer, GameSession, Team


class TeamInline(admin.TabularInline):
    model = Team
    extra = 0
    fields = ["name", "color", "score"]


@admin.register(GameSession)
class GameSessionAdmin(admin.ModelAdmin):
    list_display = ["id", "room", "host", "mode", "code", "status", "teams_list", "created_at"]
    list_filter = ["mode", "status", "room__format", "created_at"]
    list_editable = ["status"]
    search_fields = ["room__title", "host__username"]
    autocomplete_fields = ["room", "host"]
    inlines = [TeamInline]
    date_hierarchy = "created_at"

    @admin.display(description="Команды (баллы)")
    def teams_list(self, obj):
        return ", ".join(f"{t.name}: {t.score}" for t in obj.teams.all())

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("room", "host").prefetch_related("teams")


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ["name", "color_box", "score", "session"]
    search_fields = ["name", "session__room__title"]
    autocomplete_fields = ["session"]

    @admin.display(description="Цвет")
    def color_box(self, obj):
        return format_html(
            '<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:{}"></span>', obj.color
        )


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ["text", "team", "question", "session", "submitted_at"]
    list_filter = ["session__mode"]
    search_fields = ["text", "team__name", "question__text"]
    autocomplete_fields = ["team", "session"]
    raw_id_fields = ["question"]
