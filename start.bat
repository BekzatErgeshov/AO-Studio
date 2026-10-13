@echo off
chcp 65001 >nul
title AO Studio
cd /d "%~dp0backend"

rem Первый запуск: создаём окружение и ставим зависимости
if not exist "venv\Scripts\python.exe" (
    echo Создаю виртуальное окружение...
    python -m venv venv || goto :error
    echo Устанавливаю зависимости, это займёт пару минут...
    venv\Scripts\python.exe -m pip install --upgrade pip >nul
    venv\Scripts\python.exe -m pip install -r requirements.txt || goto :error
    venv\Scripts\python.exe manage.py migrate || goto :error
)

echo.
echo Запускаю AO Studio: http://localhost:8000
echo Остановить сервер: Ctrl+C
echo.
venv\Scripts\python.exe manage.py runserver
pause
exit /b

:error
echo.
echo Что-то пошло не так — смотрите сообщение выше.
pause
