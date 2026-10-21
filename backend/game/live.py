"""Онлайн-режим: публичные эндпоинты для команд (без аккаунта, по коду комнаты).

Ведущий публикует состояние игры (экран, вопрос, таймер, чей ход) — см. GameStateView.
Устройства команд раз в ~1.5 c запрашивают его здесь и отправляют ответы.
"""
import math
import re

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Answer, GameSession, Team, Violation

MAX_TEAMS = 40

# Античит: сколько нарушений прощается, прежде чем дисквалифицировать
WARNINGS_ALLOWED = 1
# Два события от одного ухода с экрана (blur + hidden) не должны стоить двух нарушений
VIOLATION_COOLDOWN = 5  # секунд
VIOLATION_LABELS = dict(Violation.KINDS)
TEAM_COLORS = [
    "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#F97316",
    "#84CC16", "#14B8A6", "#EAB308", "#F43F5E", "#A3E635",
    "#FB7185", "#FBBF24", "#22C55E", "#E879F9", "#FDBA74",
]


def normalize(text: str) -> str:
    text = (text or "").lower().replace("ё", "е")
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def answer_matches(given: str, correct: str) -> bool:
    """Подсказка ведущему: совпадает ли ответ с правильным (без учёта регистра, знаков, «ё»).

    Правильный ответ может содержать варианты через «/», «;», «,» или «или».
    """
    g = normalize(given)
    if not g:
        return False
    variants = [correct] + re.split(r"/|;|,|\(|\)|\bили\b", correct, flags=re.IGNORECASE)
    return any(g == normalize(v) for v in variants if normalize(v))


def timer_payload(session: GameSession):
    if session.timer_ends_at:
        left = max(0, math.ceil((session.timer_ends_at - timezone.now()).total_seconds()))
        return {"left": left, "running": left > 0}
    if session.timer_left is not None:
        return {"left": session.timer_left, "running": False}
    return None


def team_from_request(request, session):
    # sendBeacon (уход со страницы) не умеет слать заголовки — там токен приходит в теле
    token = request.headers.get("X-Team-Token", "") or str(request.data.get("token", ""))
    if not token:
        return None
    return session.teams.filter(token=token).first()


def public_payload(session: GameSession, team: Team | None = None):
    state = session.state or {}
    payload = {
        "code": session.code,
        "mode": session.mode,
        "status": session.status,
        "room": {"title": session.room.title, "format": session.room.format},
        "state": state,
        "version": session.state_version,
        "timer": timer_payload(session),
        "server_time": timezone.now().isoformat(),
        "teams": [
            {
                "id": t.id,
                "name": t.name,
                "color": t.color,
                "score": t.score,
                "disqualified": t.disqualified,
            }
            for t in session.teams.all()
        ],
        "anticheat": session.anticheat and session.mode == GameSession.MODE_ONLINE,
        "warnings_allowed": WARNINGS_ALLOWED,
        # Сбор команд: сколько ждём и сколько игроков в команде (0 — не задано)
        "expected_teams": session.expected_teams,
        "team_size": session.team_size,
        "me": None,
        "my_answer": None,
    }
    if team:
        payload["me"] = {
            "id": team.id,
            "name": team.name,
            "color": team.color,
            "score": team.score,
            "disqualified": team.disqualified,
            "warnings": team.warnings,
            "dq_reason": team.dq_reason,
        }
        qid = (state.get("question") or {}).get("id")
        if qid:
            ans = Answer.objects.filter(team=team, question_id=qid).first()
            payload["my_answer"] = ans.text if ans else None
    return payload


class LiveBase(APIView):
    # Публичные эндпоинты: JWT не разбираем, чтобы просроченный токен ведущего в том же браузере не давал 401
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get_session(self, code):
        return get_object_or_404(
            GameSession.objects.select_related("room"), code=code.upper(), mode=GameSession.MODE_ONLINE
        )


class LiveStateView(LiveBase):
    def get(self, request, code):
        session = self.get_session(code)
        team = team_from_request(request, session)
        if team:
            # Отметка связи — ведущий видит, что устройство команды на месте (пишем не чаще раза в 5 с)
            now = timezone.now()
            if not team.last_seen or (now - team.last_seen).total_seconds() > 5:
                Team.objects.filter(pk=team.pk).update(last_seen=now)
        return Response(public_payload(session, team))


class LiveJoinView(LiveBase):
    def post(self, request, code):
        session = self.get_session(code)
        # Повторный вход с того же устройства — возвращаем ту же команду
        existing = team_from_request(request, session)
        if existing:
            return Response({"token": existing.token, **public_payload(session, existing)})

        if session.status != GameSession.STATUS_LOBBY:
            return Response({"detail": "Игра уже началась — присоединиться нельзя."}, status=status.HTTP_400_BAD_REQUEST)
        name = str(request.data.get("name", "")).strip()[:40]
        if len(name) < 2:
            return Response({"detail": "Введите название команды (минимум 2 символа)."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            teams = list(session.teams.select_for_update())
            limit = min(session.expected_teams or MAX_TEAMS, MAX_TEAMS)
            if len(teams) >= limit:
                return Response(
                    {"detail": "Все места заняты — ведущий ждёт именно столько команд."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if any(t.name.lower() == name.lower() for t in teams):
                return Response({"detail": "Команда с таким названием уже есть."}, status=status.HTTP_400_BAD_REQUEST)
            used = {t.color for t in teams}
            color = next((c for c in TEAM_COLORS if c not in used), TEAM_COLORS[len(teams) % len(TEAM_COLORS)])
            team = Team.objects.create(session=session, name=name, color=color, token=Team.new_token())
            # Собрались все ожидаемые команды — начинаем сами, ведущему ничего нажимать не нужно
            if session.autostart and session.expected_teams and len(teams) + 1 >= session.expected_teams:
                session.status = GameSession.STATUS_ACTIVE
                session.state = {"view": "waiting"}
                session.state_version += 1
                session.save(update_fields=["status", "state", "state_version"])
        return Response({"token": team.token, **public_payload(session, team)}, status=status.HTTP_201_CREATED)


class LiveAnswerView(LiveBase):
    def post(self, request, code):
        session = self.get_session(code)
        team = team_from_request(request, session)
        if not team:
            return Response({"detail": "Сначала присоединитесь к игре."}, status=status.HTTP_403_FORBIDDEN)
        if team.disqualified:
            return Response({"detail": "Команда дисквалифицирована."}, status=status.HTTP_403_FORBIDDEN)
        state = session.state or {}
        question = state.get("question") or {}
        qid = request.data.get("question_id")
        if session.status != GameSession.STATUS_ACTIVE or not state.get("accepting") or question.get("id") != qid:
            return Response({"detail": "Приём ответов на этот вопрос закрыт."}, status=status.HTTP_400_BAD_REQUEST)
        answering = state.get("answer_team")
        if answering and answering != team.id:
            return Response({"detail": "Сейчас отвечает другая команда."}, status=status.HTTP_400_BAD_REQUEST)
        text = str(request.data.get("text", "")).strip()[:500]
        if not text:
            return Response({"detail": "Введите ответ."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            Answer.objects.update_or_create(
                team=team, question_id=qid, defaults={"session": session, "text": text}
            )
        except IntegrityError:
            return Response({"detail": "Вопрос не найден."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"ok": True, "text": text})


class LivePickView(LiveBase):
    """Команда, чей ход, выбирает клетку (стратегический) или карточку (слепой) со своего устройства."""

    def post(self, request, code):
        session = self.get_session(code)
        team = team_from_request(request, session)
        if not team:
            return Response({"detail": "Сначала присоединитесь к игре."}, status=status.HTTP_403_FORBIDDEN)
        if team.disqualified:
            return Response({"detail": "Команда дисквалифицирована."}, status=status.HTTP_403_FORBIDDEN)
        state = session.state or {}
        if session.status != GameSession.STATUS_ACTIVE or state.get("view") not in ("grid", "tiles"):
            return Response({"detail": "Сейчас выбирать нельзя."}, status=status.HTTP_400_BAD_REQUEST)
        if state.get("active_team") != team.id:
            return Response({"detail": "Сейчас ход другой команды."}, status=status.HTTP_400_BAD_REQUEST)
        qid = request.data.get("question_id")
        if qid not in (state.get("available") or []):
            return Response({"detail": "Этот вопрос уже сыгран."}, status=status.HTTP_400_BAD_REQUEST)
        session.pick = {"team_id": team.id, "question_id": qid, "at": timezone.now().isoformat()}
        session.save(update_fields=["pick"])
        return Response({"ok": True})


class LiveViolationView(LiveBase):
    """Устройство команды сообщает, что игра ушла с экрана (свернули, переключили вкладку, вышли из полного экрана).

    Первые нарушения — предупреждение, дальше команда дисквалифицируется:
    ответы и выбор клеток больше не принимаются, баллы замораживаются.
    Ведущий может простить команду и вернуть её в игру.
    """

    def post(self, request, code):
        session = self.get_session(code)
        team = team_from_request(request, session)
        if not team:
            return Response({"detail": "Сначала присоединитесь к игре."}, status=status.HTTP_403_FORBIDDEN)

        kind = request.data.get("kind")
        if kind not in VIOLATION_LABELS:
            return Response({"detail": "Неизвестный тип нарушения."}, status=status.HTTP_400_BAD_REQUEST)

        # Античит работает только в идущей игре: в лобби и на итогах телефон свободен
        inactive = not session.anticheat or session.status != GameSession.STATUS_ACTIVE
        if inactive or team.disqualified:
            return Response({
                "counted": False,
                "warnings": team.warnings,
                "disqualified": team.disqualified,
                "dq_reason": team.dq_reason,
            })

        with transaction.atomic():
            team = Team.objects.select_for_update().get(pk=team.pk)
            recent = team.violations.first()
            if recent and (timezone.now() - recent.at).total_seconds() < VIOLATION_COOLDOWN:
                # Один и тот же уход с экрана — не наказываем дважды
                return Response({
                    "counted": False,
                    "warnings": team.warnings,
                    "disqualified": team.disqualified,
                    "dq_reason": team.dq_reason,
                })

            team.warnings += 1
            fatal = team.warnings > WARNINGS_ALLOWED
            if fatal:
                team.disqualified = True
                team.dq_reason = VIOLATION_LABELS[kind]
                team.dq_at = timezone.now()
            team.save(update_fields=["warnings", "disqualified", "dq_reason", "dq_at"])
            Violation.objects.create(session=session, team=team, kind=kind, fatal=fatal)

        return Response({
            "counted": True,
            "warnings": team.warnings,
            "warnings_allowed": WARNINGS_ALLOWED,
            "disqualified": team.disqualified,
            "dq_reason": team.dq_reason,
        })
