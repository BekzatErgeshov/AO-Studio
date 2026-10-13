from django.contrib import admin
from django.db.models import Count
from django.utils.html import format_html

from .models import AORoom, Category, Like, Question


def photo_html(photo, size=60):
    if not photo:
        return "—"
    return format_html('<img src="{}" style="max-height:{}px;border-radius:8px">', photo.url, size)


class CategoryInline(admin.TabularInline):
    model = Category
    extra = 0
    fields = ["name", "order", "questions_total"]
    readonly_fields = ["questions_total"]
    show_change_link = True

    @admin.display(description="Вопросов")
    def questions_total(self, obj):
        return obj.questions.count() if obj.pk else 0


class QuestionInline(admin.StackedInline):
    model = Question
    extra = 0
    fields = [("text", "answer"), ("points", "order", "category"), ("photo", "photo_preview")]
    readonly_fields = ["photo_preview"]
    show_change_link = True

    @admin.display(description="Превью")
    def photo_preview(self, obj):
        return photo_html(obj.photo)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        # В выпадающем списке — только категории этой комнаты
        if db_field.name == "category":
            room_id = request.resolver_match.kwargs.get("object_id")
            kwargs["queryset"] = Category.objects.filter(room_id=room_id) if room_id else Category.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(AORoom)
class AORoomAdmin(admin.ModelAdmin):
    list_display = ["title", "format", "author", "is_public", "questions_total", "likes_count", "timer_duration", "created_at"]
    list_filter = ["format", "is_public", "created_at"]
    list_editable = ["is_public"]
    search_fields = ["title", "description", "author__username"]
    autocomplete_fields = ["author"]
    readonly_fields = ["likes_count", "created_at"]
    inlines = [CategoryInline, QuestionInline]
    list_per_page = 50
    fieldsets = (
        ("Комната", {"fields": ("title", "format", "author", "description")}),
        ("Настройки", {"fields": ("is_public", "timer_duration", "likes_count", "created_at")}),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("author").annotate(_q=Count("questions", distinct=True))

    @admin.display(description="Вопросов", ordering="_q")
    def questions_total(self, obj):
        return obj._q


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "room", "order"]
    list_filter = ["room__format"]
    search_fields = ["name", "room__title"]
    autocomplete_fields = ["room"]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ["short_text", "answer", "points", "room", "category", "photo_thumb"]
    list_filter = ["room__format", "points"]
    search_fields = ["text", "answer", "room__title"]
    autocomplete_fields = ["room", "category"]
    readonly_fields = ["photo_preview"]
    list_per_page = 50

    @admin.display(description="Вопрос")
    def short_text(self, obj):
        return obj.text[:70]

    @admin.display(description="Фото")
    def photo_thumb(self, obj):
        return photo_html(obj.photo, 36)

    @admin.display(description="Превью")
    def photo_preview(self, obj):
        return photo_html(obj.photo, 200)


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ["user", "room", "created_at"]
    search_fields = ["user__username", "room__title"]
    autocomplete_fields = ["user", "room"]

