from django.db import transaction
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from rooms.models import AORoom

from .models import GameSession, Team
from .serializers import GameSessionSerializer, GameStartSerializer, ScoreUpdateSerializer


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
        session = GameSession.objects.create(room=room, host=request.user)
        Team.objects.bulk_create(
            [Team(session=session, name=t["name"], color=t["color"]) for t in data["teams"]]
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
        session.save(update_fields=["status"])
        return Response(GameSessionSerializer(session).data)
