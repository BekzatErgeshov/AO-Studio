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
    # Запустить можно только одиночную игру или игру с доски (команды по QR)
    mode = serializers.ChoiceField(
        choices=[(m, m) for m in GameSession.MODE_STARTABLE], default=GameSession.MODE_SOLO
    )
    teams = TeamInputSerializer(many=True, required=False, default=list)
    # Античит имеет смысл только в онлайне (устройства команд)
    anticheat = serializers.BooleanField(default=True)
    # Настройки запуска с доски
    board = serializers.BooleanField(default=False)
    expected_teams = serializers.IntegerField(default=0, min_value=0, max_value=40)
    team_size = serializers.IntegerField(default=0, min_value=0, max_value=20)
    autostart = serializers.BooleanField(default=False)
    timer_duration = serializers.IntegerField(required=False, allow_null=True)

    def validate_timer_duration(self, value):
        from rooms.models import AORoom

        if value is not None and value not in AORoom.TIMER_CHOICES:
            allowed = ", ".join(str(t) for t in AORoom.TIMER_CHOICES)
            raise serializers.ValidationError(f"Время на вопрос — одно из: {allowed} секунд.")
        return value

    def validate(self, attrs):
        # Одиночная — «команда» создаётся из имени игрока; доска — команды подключаются по коду
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
