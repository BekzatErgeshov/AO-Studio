"""Создаёт (или обновляет) суперпользователя для админки /admin.

    python manage.py ensure_admin --username <логин> --password <пароль>

Без аргументов берёт DJANGO_ADMIN_USERNAME / DJANGO_ADMIN_PASSWORD из окружения
(удобно на Railway); если их нет — ничего не делает.
Валидаторы сложности пароля намеренно не применяются.
"""
import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Создать или обновить администратора"

    def add_arguments(self, parser):
        parser.add_argument("--username", default=os.environ.get("DJANGO_ADMIN_USERNAME"))
        parser.add_argument("--password", default=os.environ.get("DJANGO_ADMIN_PASSWORD"))
        parser.add_argument("--email", default=os.environ.get("DJANGO_ADMIN_EMAIL"))

    def handle(self, *args, username, password, email, **options):
        if not username or not password:
            self.stdout.write("ensure_admin: логин/пароль не заданы — пропускаю.")
            return
        User = get_user_model()
        user = User.objects.filter(username=username).first()
        if user is None:
            user = User(username=username, email=email or f"admin-{username}@aostudio.local")
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS(f"Администратор «{username}» готов."))
