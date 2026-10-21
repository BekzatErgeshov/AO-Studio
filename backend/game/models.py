import secrets

from django.conf import settings
from django.db import models

from rooms.models import AORoom, Question

# Без похожих символов (0/O, 1/I/L) — код удобно диктовать и вводить с телефона
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_code(length=6):
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))
        if not GameSession.objects.filter(code=code).exists():
            return code


class GameSession(models.Model):
    STATUS_LOBBY = "lobby"
    STATUS_ACTIVE = "active"
    STATUS_FINISHED = "finished"
    STATUS_CHOICES = [(STATUS_LOBBY, "Ожидание команд"), (STATUS_ACTIVE, "Идёт"), (STATUS_FINISHED, "Завершена")]

    # offline остаётся ради старых сессий в базе; новые игры бывают только одиночные и по QR
    MODE_OFFLINE = "offline"
    MODE_ONLINE = "online"
    MODE_SOLO = "solo"
    MODE_CHOICES = [
        (MODE_SOLO, "Одиночная игра"),
        (MODE_ONLINE, "Команды со своих устройств (доска)"),
        (MODE_OFFLINE, "Команды на одном экране (устарело)"),
    ]
    # Режимы, в которых можно запустить новую игру
    MODE_STARTABLE = (MODE_SOLO, MODE_ONLINE)

    room = models.ForeignKey(AORoom, on_delete=models.CASCADE, related_name="sessions")
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="hosted_sessions"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default=MODE_OFFLINE)
    # Код для входа команд (только онлайн)
    code = models.CharField(max_length=8, unique=True, null=True, blank=True)
    # Публичное состояние игры, которое публикует ведущий: экран, вопрос, таймер, чей ход…
    state = models.JSONField(default=dict, blank=True)
    state_version = models.PositiveIntegerField(default=0)
    timer_ends_at = models.DateTimeField(null=True, blank=True)
    timer_left = models.PositiveIntegerField(null=True, blank=True)  # остаток, если таймер на паузе
    # Выбор клетки/карточки командой со своего устройства: {"team_id", "question_id", "at"}
    pick = models.JSONField(null=True, blank=True)
    # Античит (онлайн): устройства команд держат игру в полном экране, уход с экрана наказывается
    anticheat = models.BooleanField("античит", default=True)
    # Запуск с умной доски: ведущий заранее задаёт состав и время, команды собираются по QR
    board = models.BooleanField("запуск с доски", default=False)
    # Сколько команд ждём (0 — без ограничения) и сколько игроков в команде (0 — не задано)
    expected_teams = models.PositiveSmallIntegerField("ожидается команд", default=0)
    team_size = models.PositiveSmallIntegerField("игроков в команде", default=0)
    # Начать игру самим, как только соберутся все ожидаемые команды
    autostart = models.BooleanField("автостарт", default=False)
    # Время на вопрос; пусто — как задано в комнате
    timer_duration = models.PositiveIntegerField("время на вопрос", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "игровая сессия"
        verbose_name_plural = "игровые сессии"
        ordering = ["-created_at"]

    def __str__(self):
        return f"#{self.pk} {self.room}"


class Team(models.Model):
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=20)
    session = models.ForeignKey(GameSession, on_delete=models.CASCADE, related_name="teams")
    score = models.IntegerField(default=0)
    # Секрет устройства команды (онлайн): им подписываются ответы
    token = models.CharField(max_length=64, blank=True, default="", editable=False)
    # Античит: счётчик нарушений, дисквалификация и момент последней связи с устройством
    warnings = models.PositiveIntegerField("предупреждения", default=0)
    disqualified = models.BooleanField("дисквалифицирована", default=False)
    dq_reason = models.CharField("причина дисквалификации", max_length=120, blank=True, default="")
    dq_at = models.DateTimeField("дисквалифицирована в", null=True, blank=True)
    last_seen = models.DateTimeField("последняя связь", null=True, blank=True)

    class Meta:
        verbose_name = "команда"
        verbose_name_plural = "команды"
        ordering = ["id"]

    def __str__(self):
        return self.name

    @staticmethod
    def new_token():
        return secrets.token_urlsafe(32)


class Answer(models.Model):
    """Ответ команды на вопрос в онлайн-игре."""

    session = models.ForeignKey(GameSession, on_delete=models.CASCADE, related_name="answers")
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="answers")
    text = models.CharField(max_length=500)
    submitted_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ответ команды"
        verbose_name_plural = "ответы команд"
        ordering = ["submitted_at"]
        constraints = [models.UniqueConstraint(fields=["team", "question"], name="one_answer_per_question")]


class Violation(models.Model):
    """Нарушение античита: команда ушла с экрана игры со своего устройства."""

    # Что именно зафиксировал браузер команды
    KINDS = [
        ("hidden", "Свернул игру или переключился на другое приложение/вкладку"),
        ("blur", "Окно игры потеряло фокус"),
        ("fullscreen", "Вышел из полноэкранного режима"),
        ("left", "Закрыл страницу игры"),
        ("lost", "Устройство пропало со связи"),
    ]

    session = models.ForeignKey(GameSession, on_delete=models.CASCADE, related_name="violations")
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="violations")
    kind = models.CharField(max_length=20, choices=KINDS)
    # Нарушение после исчерпанных предупреждений — то, за которое дисквалифицировали
    fatal = models.BooleanField(default=False)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "нарушение"
        verbose_name_plural = "нарушения"
        ordering = ["-at"]

    def __str__(self):
        return f"{self.team} — {self.get_kind_display()}"
