from django.contrib.auth import get_user_model
from django.db.models import Count, Exists, OuterRef, Q, Value
from django.db.models.fields import BooleanField
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AORoom, Category, Like, Question
from .serializers import (
    CategorySerializer,
    QuestionUpdateSerializer,
    RoomDetailSerializer,
    RoomListSerializer,
    RoomWriteSerializer,
)


class IsAuthorOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        room = obj if isinstance(obj, AORoom) else obj.room
        return room.author_id == request.user.id


def annotate_rooms(qs, user):
    qs = qs.select_related("author").prefetch_related("categories").annotate(
        questions_count=Count("questions", distinct=True)
    )
    if user.is_authenticated:
        qs = qs.annotate(is_liked=Exists(Like.objects.filter(room=OuterRef("pk"), user=user)))
    else:
        qs = qs.annotate(is_liked=Value(False, output_field=BooleanField()))
    return qs


class RoomViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return RoomWriteSerializer
        if self.action == "retrieve":
            return RoomDetailSerializer
        return RoomListSerializer

    def get_queryset(self):
        user = self.request.user
        params = self.request.query_params
        base = AORoom.objects.all()

        if self.action in ("list", "my"):
            show = "mine" if self.action == "my" else params.get("show", "all")
            if show in ("mine", "liked") and not user.is_authenticated:
                return AORoom.objects.none()
            if show == "mine":
                base = base.filter(author=user)
            elif show == "liked":
                base = base.filter(likes__user=user).filter(Q(is_public=True) | Q(author=user))
            elif show == "available" and user.is_authenticated:
                # Для запуска игры: публичные + свои приватные
                base = base.filter(Q(is_public=True) | Q(author=user))
            else:
                base = base.filter(is_public=True)
        else:
            visible = Q(is_public=True)
            if user.is_authenticated:
                visible |= Q(author=user)
            base = base.filter(visible)

        qs = annotate_rooms(base, user)

        if self.action == "retrieve":
            qs = qs.prefetch_related("categories__questions", "questions")

        if self.action in ("list", "my"):
            search = params.get("search", "").strip()
            if search:
                qs = qs.filter(title__icontains=search)
            fmt = params.get("fmt")
            if fmt in dict(AORoom.FORMAT_CHOICES):
                qs = qs.filter(format=fmt)
            qcount = params.get("qcount")
            if qcount == "5-10":
                qs = qs.filter(questions_count__gte=5, questions_count__lte=10)
            elif qcount == "10-20":
                qs = qs.filter(questions_count__gte=10, questions_count__lte=20)
            elif qcount == "20+":
                qs = qs.filter(questions_count__gte=20)
            cats = [c.strip() for c in params.get("categories", "").split(",") if c.strip()]
            if cats:
                cat_q = Q()
                for c in cats:
                    cat_q |= Q(categories__name__iexact=c)
                qs = qs.filter(cat_q).exclude(format=AORoom.FORMAT_BLIND).distinct()
        return qs

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def my(self, request):
        return Response(RoomListSerializer(self.get_queryset(), many=True, context={"request": request}).data)

    @action(
        detail=False, methods=["get"], url_path="categories-list",
        permission_classes=[permissions.AllowAny],
    )
    def categories_list(self, request):
        """Популярные категории для фильтра-мультиселекта."""
        names = (
            Category.objects.filter(room__is_public=True)
            .exclude(room__format=AORoom.FORMAT_BLIND)
            .values("name")
            .annotate(n=Count("id"))
            .order_by("-n", "name")[:30]
        )
        return Response([n["name"] for n in names])

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, pk=None):
        room = self.get_object()
        like = Like.objects.filter(user=request.user, room=room).first()
        # likes_count пересчитывается сигналами (rooms/signals.py)
        if like:
            like.delete()
            liked = False
        else:
            Like.objects.create(user=request.user, room=room)
            liked = True
        room.refresh_from_db(fields=["likes_count"])
        return Response({"is_liked": liked, "likes_count": room.likes_count})

    def _own_room(self):
        room = self.get_object()
        if room.author_id != self.request.user.id:
            raise PermissionDenied("Только автор может изменять комнату.")
        return room

    @action(
        detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated],
        parser_classes=[JSONParser, MultiPartParser, FormParser],
    )
    def questions(self, request, pk=None):
        room = self._own_room()
        category = None
        if request.data.get("category"):
            category = generics.get_object_or_404(Category, pk=request.data["category"], room=room)
        serializer = QuestionUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(room=room, category=category, order=room.questions.count())
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def categories(self, request, pk=None):
        room = self._own_room()
        if room.format == AORoom.FORMAT_BLIND:
            return Response(
                {"detail": "В слепом формате нет категорий."}, status=status.HTTP_400_BAD_REQUEST
            )
        serializer = CategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(room=room, order=room.categories.count())
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class QuestionViewSet(mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = QuestionUpdateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAuthorOrReadOnly]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return Question.objects.filter(room__author=self.request.user)

    def perform_destroy(self, instance):
        instance.photo.delete(save=False)
        instance.delete()


class CategoryViewSet(mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated, IsAuthorOrReadOnly]

    def get_queryset(self):
        return Category.objects.filter(room__author=self.request.user)


class PlatformStatsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from game.models import GameSession

        return Response({
            "users": get_user_model().objects.count(),
            "rooms": AORoom.objects.count(),
            "games": GameSession.objects.count(),
            "rating": 98,
        })
