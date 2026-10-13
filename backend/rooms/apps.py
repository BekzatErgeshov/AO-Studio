from django.apps import AppConfig


class RoomsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "rooms"
    verbose_name = "AO комнаты"

    def ready(self):
        from . import signals  # noqa: F401
