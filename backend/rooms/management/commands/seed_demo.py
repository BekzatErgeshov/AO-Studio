"""Создаёт демо-пользователя и примеры AO комнат всех трёх форматов.

Запуск: python manage.py seed_demo
Логин: demo / demo-ao-2026
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from rooms.models import AORoom
from rooms.serializers import RoomWriteSerializer

DEMO_USERNAME = "demo"
DEMO_EMAIL = "demo@aostudio.kg"
DEMO_PASSWORD = "demo-ao-2026"

ROOMS = [
    {
        "title": "Кыргызстан: история и география",
        "format": "classic",
        "timer_duration": 60,
        "description": "Классическая разминка о родной стране.",
        "categories": [
            {"name": "География", "questions": [
                {"text": "Какое озеро — крупнейшее в Кыргызстане?", "answer": "Иссык-Куль", "points": 1},
                {"text": "Как называется самая высокая точка Кыргызстана?", "answer": "Пик Жеңиш (Победы)", "points": 2},
                {"text": "Столица Кыргызстана?", "answer": "Бишкек", "points": 1},
            ]},
            {"name": "Культура", "questions": [
                {"text": "Как называется кыргызский эпос — один из самых объёмных в мире?", "answer": "Манас", "points": 2},
                {"text": "Трёхструнный кыргызский музыкальный инструмент?", "answer": "Комуз", "points": 1},
                {"text": "Как называется войлочная юрта по-кыргызски?", "answer": "Боз үй", "points": 3},
            ]},
        ],
    },
    {
        "title": "Своя игра: IT",
        "format": "strategic",
        "timer_duration": 45,
        "description": "Программирование и компьютеры — по стоимости как в «Своей игре».",
        "categories": [
            {"name": "Python", "questions": [
                {"text": "Какой оператор выводит текст на экран?", "answer": "print()", "points": 1},
                {"text": "Как называется неизменяемый список?", "answer": "Кортеж (tuple)", "points": 2},
                {"text": "Что вернёт len('Акыл')?", "answer": "4", "points": 3},
                {"text": "Ключевое слово для объявления генератора?", "answer": "yield", "points": 4},
                {"text": "Что такое GIL?", "answer": "Global Interpreter Lock", "points": 5},
            ]},
            {"name": "Web", "questions": [
                {"text": "Что означает HTML?", "answer": "HyperText Markup Language", "points": 1},
                {"text": "Какой HTTP-код означает «Не найдено»?", "answer": "404", "points": 2},
                {"text": "Язык стилей веб-страниц?", "answer": "CSS", "points": 3},
                {"text": "Какой метод HTTP используется для создания ресурса?", "answer": "POST", "points": 4},
                {"text": "Что такое CORS?", "answer": "Cross-Origin Resource Sharing", "points": 5},
            ]},
            {"name": "Железо", "questions": [
                {"text": "Мозг компьютера — это…", "answer": "Процессор (CPU)", "points": 1},
                {"text": "Сколько бит в байте?", "answer": "8", "points": 2},
                {"text": "Энергозависимая память компьютера?", "answer": "ОЗУ (RAM)", "points": 3},
                {"text": "Что означает SSD?", "answer": "Solid State Drive", "points": 4},
                {"text": "Кто считается первым программистом?", "answer": "Ада Лавлейс", "points": 5},
            ]},
        ],
    },
    {
        "title": "Эрудит вслепую",
        "format": "random",
        "timer_duration": 30,
        "description": "Скрытые карточки с вопросами обо всём на свете.",
        "questions": [
            {"text": "Сколько континентов на Земле?", "answer": "7"},
            {"text": "Самая длинная река в мире?", "answer": "Нил (или Амазонка)"},
            {"text": "Химический символ золота?", "answer": "Au"},
            {"text": "Кто написал «Белый пароход»?", "answer": "Чингиз Айтматов"},
            {"text": "Сколько планет в Солнечной системе?", "answer": "8"},
            {"text": "Самое большое животное на Земле?", "answer": "Синий кит"},
            {"text": "Сколько сторон у шестиугольника?", "answer": "6"},
            {"text": "Самый лёгкий химический элемент?", "answer": "Водород"},
            {"text": "Сколько минут в сутках?", "answer": "1440"},
            {"text": "Какая планета — красная?", "answer": "Марс"},
            {"text": "В каком году человек впервые полетел в космос?", "answer": "1961"},
            {"text": "Сколько струн у комуза?", "answer": "3"},
        ],
    },
]


class Command(BaseCommand):
    help = "Создать демо-пользователя и примеры AO комнат"

    def handle(self, *args, **options):
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=DEMO_USERNAME, defaults={"email": DEMO_EMAIL}
        )
        if created:
            user.set_password(DEMO_PASSWORD)
            user.save()
        for data in ROOMS:
            if AORoom.objects.filter(author=user, title=data["title"]).exists():
                continue
            s = RoomWriteSerializer(data=data)
            s.is_valid(raise_exception=True)
            s.save(author=user)
        self.stdout.write(self.style.SUCCESS(
            f"Готово. Логин: {DEMO_USERNAME} / пароль: {DEMO_PASSWORD}"
        ))
