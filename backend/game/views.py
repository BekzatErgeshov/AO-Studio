from datetime import timedelta

from django.db import transaction
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from rooms.models import AORoom

from .live import WARNINGS_ALLOWED, answer_matches
from .models import Answer, GameSession, Team, generate_code
from .serializers import (
    GameSessionSerializer,
    GameStartSerializer,
    ScoreUpdateSerializer,
    StateUpdateSerializer,
)


def host_session(request, pk):
    return get_object_or_404(GameSession, pk=pk, host=request.user)


class GameStartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = GameStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        room = get_object_or_404(
            AORoom, Q(is_public=True) | Q(author=request.user), pk=data["room_id"]
        )
        online = data["mode"] == GameSession.MODE_ONLINE
        session = GameSession.objects.create(
            room=room,
            host=request.user,
            mode=data["mode"],
            status=GameSession.STATUS_LOBBY if online else GameSession.STATUS_ACTIVE,
            code=generate_code() if online else None,
            state={"view": "lobby"} if online else {},
            anticheat=online and data["anticheat"],
        )
        teams = data["teams"]
        if data["mode"] == GameSession.MODE_SOLO:
            # Одиночная игра: единственная «команда» — сам игрок
            teams = [{"name": request.user.username, "color": "#10B981"}]
        Team.objects.bulk_create(
            [Team(session=session, name=t["name"], color=t["color"]) for t in teams]
        )
        return Response(GameSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class GameDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        return Response(GameSessionSerializer(host_session(request, pk)).data)


class GameScoreView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        session = host_session(request, pk)
        serializer = ScoreUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        team = get_object_or_404(Team, pk=data["team_id"], session=session)
        if team.disqualified:
            return Response(
                {"detail": "Команда дисквалифицирована — её баллы заморожены."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if "score" in data:
            team.score = data["score"]
            team.save(update_fields=["score"])
        else:
            Team.objects.filter(pk=team.pk).update(score=F("score") + data["delta"])
        return Response(GameSessionSerializer(session).data)


class GameFinishView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        session = host_session(request, pk)
        session.status = GameSession.STATUS_FINISHED
        session.state = {**(session.state or {}), "view": "results"}
        session.state_version += 1
        session.timer_ends_at = None
        session.timer_left = None
        session.save(update_fields=["status", "state", "state_version", "timer_ends_at", "timer_left"])
        return Response(GameSessionSerializer(session).data)


# ---------- Онлайн-режим: управление ведущего ----------

class GameStateView(APIView):
    """Ведущий публикует публичное состояние игры (то, что видят команды)."""

    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        session = host_session(request, pk)
        serializer = StateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        session.state = data["state"]
        session.state_version += 1
        fields = ["state", "state_version"]
        if data["state"].get("view") not in ("grid", "tiles") and session.pick:
            session.pick = None
            fields.append("pick")
        if "timer" in data:
            timer = data["timer"]
            if not timer:
                session.timer_ends_at, session.timer_left = None, None
            elif timer.get("running"):
                session.timer_ends_at = timezone.now() + timedelta(seconds=int(timer.get("left", 0)))
                session.timer_left = None
            else:
                session.timer_ends_at, session.timer_left = None, max(0, int(timer.get("left", 0)))
            fields += ["timer_ends_at", "timer_left"]
        session.save(update_fields=fields)
        return Response({"version": session.state_version})


class GameBeginView(APIView):
    """Из лобби в игру: дальше новые команды присоединиться не могут."""

    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        session = host_session(request, pk)
        if session.status != GameSession.STATUS_LOBBY:
            return Response({"detail": "Игра уже началась."}, status=status.HTTP_400_BAD_REQUEST)
        if not session.teams.exists():
            return Response({"detail": "Дождитесь хотя бы одной команды."}, status=status.HTTP_400_BAD_REQUEST)
        session.status = GameSession.STATUS_ACTIVE
        session.state = {"view": "waiting"}
        session.state_version += 1
        session.save(update_fields=["status", "state", "state_version"])
        return Response(GameSessionSerializer(session).data)


class GameTeamDeleteView(APIView):
    """Ведущий убирает команду из лобби."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk, team_id):
        session = host_session(request, pk)
        if session.status != GameSession.STATUS_LOBBY:
            return Response({"detail": "Убрать команду можно только до начала игры."}, status=status.HTTP_400_BAD_REQUEST)
        get_object_or_404(Team, pk=team_id, session=session).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class GameAnswersView(APIView):
    """Опрос ведущего в онлайн-игре: ответы команд на вопросы (+ подсказка о совпадении) и выбор клетки командой."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        session = host_session(request, pk)
        ids = [int(i) for i in request.query_params.get("questions", "").split(",") if i.strip().isdigit()]
        answers = Answer.objects.filter(session=session, question_id__in=ids).select_related("question")
        return Response({
            "answers": [
                {
                    "question_id": a.question_id,
                    "team_id": a.team_id,
                    "text": a.text,
                    "matches": answer_matches(a.text, a.question.answer),
                    "submitted_at": a.submitted_at,
                }
                for a in answers
            ],
            "pick": session.pick,
        })


class GameAnticheatView(APIView):
    """Ведущий следит за античитом: предупреждения, дисквалификации и связь с устройствами команд."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        session = host_session(request, pk)
        now = timezone.now()
        return Response({
            "anticheat": session.anticheat,
            "warnings_allowed": WARNINGS_ALLOWED,
            "teams": [
                {
                    "id": t.id,
                    "name": t.name,
                    "color": t.color,
                    "score": t.score,
                    "warnings": t.warnings,
                    "disqualified": t.disqualified,
                    "dq_reason": t.dq_reason,
                    # Устройство молчит дольше 10 с — скорее всего, страница игры закрыта
                    "offline": bool(t.last_seen and (now - t.last_seen).total_seconds() > 10),
                }
                for t in session.teams.all()
            ],
            "violations": [
                {
                    "id": v.id,
                    "team_id": v.team_id,
                    "team": v.team.name,
                    "kind": v.kind,
                    "label": v.get_kind_display(),
                    "fatal": v.fatal,
                    "at": v.at,
                }
                for v in session.violations.select_related("team")[:30]
            ],
        })


class GamePardonView(APIView):
    """Ведущий прощает команду: снимает дисквалификацию и обнуляет предупреждения."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, team_id):
        session = host_session(request, pk)
        team = get_object_or_404(Team, pk=team_id, session=session)
        team.warnings = 0
        team.disqualified = False
        team.dq_reason = ""
        team.dq_at = None
        team.save(update_fields=["warnings", "disqualified", "dq_reason", "dq_at"])
        return Response({"ok": True, "team_id": team.id})
