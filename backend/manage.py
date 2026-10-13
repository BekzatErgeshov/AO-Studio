#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def venv_python():
    """Python из backend/venv, если окружение есть."""
    for rel in ("venv/Scripts/python.exe", "venv/bin/python"):
        path = BASE_DIR / rel
        if path.exists():
            return path
    return None


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        # Запустили системным Python без активированного venv — перезапускаемся через backend/venv
        python = venv_python()
        if python and Path(sys.executable).resolve() != python.resolve():
            sys.exit(subprocess.call([str(python), str(Path(__file__).resolve()), *sys.argv[1:]]))
        raise ImportError(
            "Django не найден. Создайте окружение и установите зависимости:\n"
            "  python -m venv venv\n"
            "  venv\\Scripts\\python -m pip install -r requirements.txt\n"
            "или просто запустите start.bat в корне проекта."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
