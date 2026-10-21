from rest_framework import serializers

from .models import GameSession, Team


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ["id", "name", "color", "score", "warnings", "disqualified", "dq_reason"]


class GameSessionSerializer(serializers.ModelSerializer):
    teams = TeamSerializer(many=True, read_only=True)

    class Meta:
        model = GameSession
        fields = [
            "id", "room", "host", "status", "mode", "code", "anticheat",
            "board", "expected_teams", "team_size", "autostart", "timer_duration",
            "created_at", "teams",
        ]


class TeamInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, error_messages={"blank": "Введите название команды."})
    color = serializers.CharField(max_length=20)


class GameStartSerializer(serializers.Serializer):
    room_id = serializers.IntegerField()
    mode = serializers.ChoiceField(choices=GameSession.MODE_CHOICES, default=GameSession.MODE_OFFLINE)
    teams = TeamInputSerializer(many=True, required=False, default=list)
    # Античит имеет смысл только в онлайне (устройства команд)
    anticheat = serializers.BooleanField(default=True)
    # Настройки запуска с доски
    board = serializers.BooleanField(default=False)
    expected_teams = serializers.IntegerField(default=0, min_value=0, max_value=40)
    team_size = serializers.IntegerField(default=0, min_value=0, max_value=20)
    autostart = serializers.BooleanField(default=False)
    timer_duration = serializers.IntegerField(required=False, allow_null=True, min_value=5, max_value=3600)

    def validate(self, attrs):
        # Офлайн — команды вводит ведущий; онлайн — команды подключаются сами по коду
        # Один — команда создаётся автоматически из имени игрока
        if attrs["mode"] == GameSession.MODE_OFFLINE and not attrs["teams"]:
            raise serializers.ValidationError({"teams": "Нужна хотя бы одна команда."})
        return attrs


class ScoreUpdateSerializer(serializers.Serializer):
    team_id = serializers.IntegerField()
    score = serializers.IntegerField(required=False)
    delta = serializers.IntegerField(required=False)

    def validate(self, attrs):
        if "score" not in attrs and "delta" not in attrs:
            raise serializers.ValidationError("Укажите score или delta.")
        return attrs


class StateUpdateSerializer(serializers.Serializer):
    state = serializers.DictField()
    # Таймер: сколько секунд осталось и идёт ли он. null — таймера нет
    timer = serializers.DictField(required=False, allow_null=True)

    def validate_state(self, value):
        import json

        if len(json.dumps(value, ensure_ascii=False)) > 30_000:
            raise serializers.ValidationError("Слишком большое состояние.")
        return value
