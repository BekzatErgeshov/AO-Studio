from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class AORoom(models.Model):
    FORMAT_CLASSIC = "classic"
    FORMAT_RANDOM = "random"
    FORMAT_STRATEGIC = "strategic"
    FORMAT_CHOICES = [
        (FORMAT_CLASSIC, "Классический"),
        (FORMAT_RANDOM, "Рандом"),
        (FORMAT_STRATEGIC, "Стратегический"),
    ]
    # Классика и рандом — все вопросы по одному баллу; баллы задаются только в стратегическом
    ONE_POINT_FORMATS = (FORMAT_CLASSIC, FORMAT_RANDOM)
    # Вопросы лежат в категориях; в рандоме они идут вперемешку
    CATEGORY_FORMATS = (FORMAT_CLASSIC, FORMAT_STRATEGIC)

    title = models.CharField(max_length=200)
    format = models.CharField(max_length=20, choices=FORMAT_CHOICES)
    timer_duration = models.PositiveIntegerField(default=60)
    is_public = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="rooms"
    )
    likes_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "AO комната"
        verbose_name_plural = "AO комнаты"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Category(models.Model):
    name = models.CharField(max_length=100)
    room = models.ForeignKey(AORoom, on_delete=models.CASCADE, related_name="categories")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "категория"
        verbose_name_plural = "категории"
        ordering = ["order", "id"]

    def __str__(self):
        return self.name


class Question(models.Model):
    text = models.TextField()
    answer = models.CharField(max_length=500)
    # Балл задаётся только в стратегическом формате: от 1 до 5
    points = models.PositiveSmallIntegerField(
        default=1, validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    photo = models.ImageField(upload_to="questions/", blank=True, null=True)
    category = models.ForeignKey(
        Category, on_delete=models.CASCADE, related_name="questions", null=True, blank=True
    )
    room = models.ForeignKey(AORoom, on_delete=models.CASCADE, related_name="questions")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "вопрос"
        verbose_name_plural = "вопросы"
        ordering = ["order", "id"]

    def __str__(self):
        return self.text[:50]


class Like(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="likes")
    room = models.ForeignKey(AORoom, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "лайк"
        verbose_name_plural = "лайки"
        constraints = [models.UniqueConstraint(fields=["user", "room"], name="unique_like")]
