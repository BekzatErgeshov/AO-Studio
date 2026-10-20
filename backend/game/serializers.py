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
        fields = ["id", "room", "host", "status", "mode", "code", "created_at", "teams"]


class TeamInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, error_messages={"blank": "Введите название команды."})
    color = serializers.CharField(max_length=20)


class GameStartSerializer(serializers.Serializer):
    room_id = serializers.IntegerField()
    mode = serializers.ChoiceField(choices=GameSession.MODE_CHOICES, default=GameSession.MODE_OFFLINE)
    teams = TeamInputSerializer(many=True, required=False, default=list)

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
