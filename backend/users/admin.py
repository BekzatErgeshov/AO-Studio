from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import AdminUserCreationForm, UserChangeForm
from django.db.models import Count
from django.utils.html import format_html

from .models import User


class UserCreateForm(AdminUserCreationForm):
    class Meta(AdminUserCreationForm.Meta):
        model = User
        fields = ("username", "email")


class UserEditForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    form = UserEditForm
    add_form = UserCreateForm

    list_display = [
        "avatar_thumb", "username", "email", "google_linked", "rooms_total", "games_total",
        "is_active", "is_staff", "created_at",
    ]
    list_display_links = ["avatar_thumb", "username"]
    list_filter = ["is_active", "is_staff", "is_superuser", "created_at"]
    list_editable = ["is_active"]
    search_fields = ["username", "email"]
    ordering = ["-created_at"]
    readonly_fields = ["avatar_preview", "google_linked", "created_at", "last_login", "date_joined"]
    list_per_page = 50

    fieldsets = (
        ("Аккаунт", {"fields": ("username", "email", "password", "google_linked")}),
        ("Профиль", {"fields": ("avatar", "avatar_preview", "first_name", "last_name")}),
        ("Права", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Даты", {"fields": ("created_at", "last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("username", "email", "password1", "password2", "is_staff", "is_superuser"),
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _rooms=Count("rooms", distinct=True), _games=Count("hosted_sessions", distinct=True)
        )

    @admin.display(description="Комнат", ordering="_rooms")
    def rooms_total(self, obj):
        return obj._rooms

    @admin.display(description="Игр", ordering="_games")
    def games_total(self, obj):
        return obj._games

    @admin.display(description="")
    def avatar_thumb(self, obj):
        if obj.avatar:
            return format_html('<img src="{}" style="width:32px;height:32px;border-radius:50%;object-fit:cover">', obj.avatar.url)
        return format_html(
            '<span style="display:inline-flex;width:32px;height:32px;border-radius:50%;background:#10B981;'
            'color:#fff;align-items:center;justify-content:center;font-weight:700;font-size:12px">{}</span>',
            obj.username[:2].upper(),
        )

    @admin.display(description="Google", boolean=True)
    def google_linked(self, obj):
        return bool(obj.google_sub)

    @admin.display(description="Аватар")
    def avatar_preview(self, obj):
        if obj.avatar:
            return format_html('<img src="{}" style="max-width:160px;border-radius:12px">', obj.avatar.url)
        return "—"
