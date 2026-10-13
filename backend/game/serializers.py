from rest_framework import serializers

from .models import GameSession, Team


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ["id", "name", "color", "score"]


class GameSessionSerializer(serializers.ModelSerializer):
    teams = TeamSerializer(many=True, read_only=True)

    class Meta:
        model = GameSession
        fields = ["id", "room", "host", "status", "created_at", "teams"]


class TeamInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, error_messages={"blank": "Введите название команды."})
    color = serializers.CharField(max_length=20)


class GameStartSerializer(serializers.Serializer):
    room_id = serializers.IntegerField()
    teams = TeamInputSerializer(many=True)

    def validate_teams(self, value):
        if not value:
            raise serializers.ValidationError("Нужна хотя бы одна команда.")
        return value


class ScoreUpdateSerializer(serializers.Serializer):
    team_id = serializers.IntegerField()
    score = serializers.IntegerField(required=False)
    delta = serializers.IntegerField(required=False)

    def validate(self, attrs):
        if "score" not in attrs and "delta" not in attrs:
            raise serializers.ValidationError("Укажите score или delta.")
        return attrs
