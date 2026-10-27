from django.db import transaction
from rest_framework import serializers

from users.serializers import PublicUserSerializer

from .models import AORoom, Category, Question


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ["id", "text", "answer", "points", "photo", "category", "order"]
        read_only_fields = ["id", "category"]


class QuestionUpdateSerializer(serializers.ModelSerializer):
    remove_photo = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = Question
        fields = ["id", "text", "answer", "points", "photo", "order", "remove_photo"]

    def update(self, instance, validated_data):
        if validated_data.pop("remove_photo", False):
            instance.photo.delete(save=False)
            instance.photo = None
        return super().update(instance, validated_data)


class CategorySerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "order", "questions"]
        read_only_fields = ["id", "questions"]


class SavedFromSerializer(serializers.ModelSerializer):
    """Откуда сохранена копия — показываем на карточке в профиле."""

    author = PublicUserSerializer(read_only=True)

    class Meta:
        model = AORoom
        fields = ["id", "title", "author"]


class RoomListSerializer(serializers.ModelSerializer):
    author = PublicUserSerializer(read_only=True)
    categories = serializers.SerializerMethodField()
    questions_count = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    my_copy_id = serializers.SerializerMethodField()
    saved_from = SavedFromSerializer(read_only=True)

    class Meta:
        model = AORoom
        fields = [
            "id", "title", "format", "timer_duration", "is_public", "description",
            "author", "saves_count", "created_at", "categories", "questions_count",
            "is_saved", "my_copy_id", "saved_from",
        ]

    def get_questions_count(self, obj):
        if hasattr(obj, "questions_count"):
            return obj.questions_count
        return obj.questions.count()

    def get_is_saved(self, obj):
        if hasattr(obj, "is_saved"):
            return obj.is_saved
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.copies.filter(author=request.user).exists()

    def get_my_copy_id(self, obj):
        if hasattr(obj, "my_copy_id"):
            return obj.my_copy_id
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        copy = obj.copies.filter(author=request.user).first()
        return copy.id if copy else None

    def get_categories(self, obj):
        # В рандоме вопросы идут вперемешку, категорий нет
        if obj.format not in AORoom.CATEGORY_FORMATS:
            return []
        return [c.name for c in obj.categories.all()]


class RoomDetailSerializer(RoomListSerializer):
    categories = CategorySerializer(many=True, read_only=True)
    questions = serializers.SerializerMethodField()

    class Meta(RoomListSerializer.Meta):
        fields = RoomListSerializer.Meta.fields + ["questions"]

    def get_questions(self, obj):
        # Вопросы без категории (формат «Рандом»)
        qs = [q for q in obj.questions.all() if q.category_id is None]
        return QuestionSerializer(qs, many=True, context=self.context).data


# ---------- Запись комнаты целиком (вложенные категории и вопросы) ----------

class QuestionInputSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    text = serializers.CharField(error_messages={"blank": "Введите текст вопроса."})
    answer = serializers.CharField(max_length=500, error_messages={"blank": "Введите ответ."})
    # Балл важен только в стратегическом формате; в остальных он всегда 1
    points = serializers.IntegerField(min_value=1, max_value=5, default=1)
    remove_photo = serializers.BooleanField(required=False, default=False)


class CategoryInputSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    name = serializers.CharField(max_length=100, error_messages={"blank": "Введите название категории."})
    questions = QuestionInputSerializer(many=True)


class RoomWriteSerializer(serializers.ModelSerializer):
    categories = CategoryInputSerializer(many=True, required=False)
    questions = QuestionInputSerializer(many=True, required=False)

    class Meta:
        model = AORoom
        fields = [
            "id", "title", "format", "timer_duration", "is_public", "description",
            "categories", "questions",
        ]

    def validate_timer_duration(self, value):
        if value not in AORoom.TIMER_CHOICES:
            allowed = ", ".join(str(t) for t in AORoom.TIMER_CHOICES)
            raise serializers.ValidationError(f"Время на вопрос — одно из: {allowed} секунд.")
        return value

    def validate(self, attrs):
        fmt = attrs.get("format", getattr(self.instance, "format", None))
        has_content = "categories" in attrs or "questions" in attrs
        if self.instance is None or has_content:
            if fmt not in AORoom.CATEGORY_FORMATS:
                if not attrs.get("questions"):
                    raise serializers.ValidationError({"questions": "Добавьте хотя бы один вопрос."})
            else:
                cats = attrs.get("categories") or []
                if not cats:
                    raise serializers.ValidationError({"categories": "Добавьте хотя бы одну категорию."})
                if not any(c["questions"] for c in cats):
                    raise serializers.ValidationError({"categories": "Добавьте хотя бы один вопрос."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        categories = validated_data.pop("categories", None)
        questions = validated_data.pop("questions", None)
        room = AORoom.objects.create(**validated_data)
        self._sync(room, categories, questions)
        return room

    @transaction.atomic
    def update(self, instance, validated_data):
        has_content = "categories" in validated_data or "questions" in validated_data
        categories = validated_data.pop("categories", None)
        questions = validated_data.pop("questions", None)
        instance = super().update(instance, validated_data)
        if has_content:
            self._sync(instance, categories, questions)
        return instance

    def _upsert_question(self, room, data, category, order, existing):
        q = existing.get(data.get("id")) or Question(room=room)
        q.text = data["text"]
        q.answer = data["answer"]
        # Баллы назначаются только в стратегическом формате, в остальных — всегда 1
        q.points = 1 if room.format in AORoom.ONE_POINT_FORMATS else data["points"]
        q.category = category
        q.order = order
        if data.get("remove_photo") and q.photo:
            q.photo.delete(save=False)
            q.photo = None
        q.save()
        return q.id

    def _sync(self, room, categories, questions):
        """Синхронизирует категории/вопросы: обновляет по id, создаёт новые, удаляет лишние."""
        existing_q = {q.id: q for q in room.questions.all()}
        existing_c = {c.id: c for c in room.categories.all()}
        keep_q, keep_c = set(), set()

        if room.format not in AORoom.CATEGORY_FORMATS:
            for i, qd in enumerate(questions or []):
                keep_q.add(self._upsert_question(room, qd, None, i, existing_q))
        else:
            for ci, cd in enumerate(categories or []):
                cat = existing_c.get(cd.get("id")) or Category(room=room)
                cat.name = cd["name"]
                cat.order = ci
                cat.save()
                keep_c.add(cat.id)
                for qi, qd in enumerate(cd["questions"]):
                    keep_q.add(self._upsert_question(room, qd, cat, qi, existing_q))

        for qid, q in existing_q.items():
            if qid not in keep_q:
                q.photo.delete(save=False)
                q.delete()
        room.categories.exclude(id__in=keep_c).delete()

    def to_representation(self, instance):
        # Перечитываем из БД, чтобы не отдать устаревшие аннотации (questions_count)
        fresh = AORoom.objects.get(pk=instance.pk)
        return RoomDetailSerializer(fresh, context=self.context).data
