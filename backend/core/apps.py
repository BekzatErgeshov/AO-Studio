from django.apps import AppConfig
from django.conf import settings
from django.utils.autoreload import autoreload_started


def watch_env_file(sender, **kwargs):
    # runserver перезапускается сам после сохранения backend/.env
    sender.extra_files.add(settings.BASE_DIR / ".env")


class CoreConfig(AppConfig):
    name = "core"
    verbose_name = "Ядро"

    def ready(self):
        autoreload_started.connect(watch_env_file)
