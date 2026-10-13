"""Сборка React-фронтенда (frontend/) в frontend/dist, который раздаёт Django."""
import shutil
import subprocess
from pathlib import Path

from django.conf import settings

FRONTEND_DIR: Path = settings.FRONTEND_DIR
DIST_DIR: Path = settings.FRONTEND_DIST
WATCHED = ["src", "public", "index.html", "package.json", "package-lock.json", "vite.config.ts", "tsconfig.app.json"]


def latest_source_mtime() -> float:
    latest = 0.0
    for name in WATCHED:
        path = FRONTEND_DIR / name
        if path.is_file():
            latest = max(latest, path.stat().st_mtime)
        elif path.is_dir():
            for f in path.rglob("*"):
                if f.is_file():
                    latest = max(latest, f.stat().st_mtime)
    return latest


def needs_build() -> bool:
    index = DIST_DIR / "index.html"
    return not index.exists() or latest_source_mtime() > index.stat().st_mtime


def build(log=print) -> bool:
    """Ставит зависимости (если нужно) и собирает фронтенд. Возвращает True при успехе."""
    npm = shutil.which("npm")
    if not npm:
        log("npm не найден — установите Node.js (https://nodejs.org), чтобы собрать фронтенд.")
        return False
    if not (FRONTEND_DIR / "node_modules").exists():
        log("Устанавливаю зависимости фронтенда (npm install)…")
        if subprocess.run([npm, "install"], cwd=FRONTEND_DIR).returncode != 0:
            return False
    log("Собираю фронтенд (npm run build)…")
    return subprocess.run([npm, "run", "build"], cwd=FRONTEND_DIR).returncode == 0
