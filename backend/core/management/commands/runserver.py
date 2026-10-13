"""runserver, который собирает React-фронтенд и пересобирает его при изменениях.

Так весь проект (сайт + API + админка) запускается одной командой:
    python manage.py runserver
После сохранения файла во frontend/ сайт пересобирается сам — достаточно обновить страницу.
Флаг --skip-build — запустить без сборки и без слежения за фронтендом.
"""
import os
import threading
import time

from django.contrib.staticfiles.management.commands.runserver import Command as StaticRunserver

from core import frontend


class Command(StaticRunserver):
    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument("--skip-build", action="store_true", help="Не собирать фронтенд и не следить за ним")

    def _log(self, msg, style=None):
        self.stdout.write((style or self.style.WARNING)(msg))

    def handle(self, *args, **options):
        self.skip_build = options["skip_build"]
        # Первичная сборка — только в основном процессе, не в перезапусках автоперезагрузчика
        if not self.skip_build and os.environ.get("RUN_MAIN") != "true":
            if frontend.needs_build():
                if frontend.build(log=self._log):
                    self._log("Фронтенд собран.", self.style.SUCCESS)
                else:
                    self._log("Сборка фронтенда не удалась — сайт может быть устаревшим.", self.style.ERROR)
            else:
                self.stdout.write("Фронтенд актуален, сборка не нужна.")
        super().handle(*args, **options)

    def inner_run(self, *args, **options):
        # inner_run выполняется в рабочем процессе сервера — здесь и следим за фронтендом
        if not self.skip_build:
            threading.Thread(target=self._watch_frontend, daemon=True, name="frontend-watcher").start()
        super().inner_run(*args, **options)

    def _watch_frontend(self):
        last = frontend.latest_source_mtime()
        while True:
            time.sleep(1.5)
            current = frontend.latest_source_mtime()
            if current <= last:
                continue
            time.sleep(0.7)  # даём редактору дописать файлы (сохранение нескольких файлов подряд)
            last = frontend.latest_source_mtime()
            self._log("Фронтенд изменился — пересобираю…")
            if frontend.build(log=self._log):
                self._log("Готово — обновите страницу в браузере.", self.style.SUCCESS)
            else:
                self._log("Ошибка сборки — смотрите сообщения выше; сайт остался на прошлой версии.", self.style.ERROR)

    def on_bind(self, server_port):
        super().on_bind(server_port)
        addr = self.addr if not self._raw_ipv6 else f"[{self.addr}]"
        if addr in ("127.0.0.1", "0.0.0.0"):
            addr = "localhost"  # вход через Google работает только с localhost, не с 127.0.0.1
        self.stdout.write(self.style.SUCCESS(
            f"AO Studio: http://{addr}:{server_port}/   ·   админка: http://{addr}:{server_port}/admin/"
        ))
