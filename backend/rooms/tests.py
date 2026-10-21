from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import AORoom, Question

User = get_user_model()


class PointsByFormatTests(APITestCase):
    """Баллы назначаются только в стратегическом формате; в классике и рандоме вопрос стоит 1 балл."""

    def setUp(self):
        self.author = User.objects.create_user(username="author", email="author@test.local", password="pwd12345")
        self.client.force_authenticate(self.author)

    def create_room(self, fmt, points):
        body = {"title": f"Комната {fmt}", "format": fmt, "timer_duration": 60, "is_public": True}
        question = {"text": "2+2?", "answer": "4", "points": points}
        if fmt == AORoom.FORMAT_RANDOM:
            body["questions"] = [question]
        else:
            body["categories"] = [{"name": "Математика", "questions": [question]}]
        return self.client.post("/api/rooms/", body, format="json")

    def test_classic_and_random_questions_always_cost_one_point(self):
        for fmt in (AORoom.FORMAT_CLASSIC, AORoom.FORMAT_RANDOM):
            with self.subTest(fmt=fmt):
                res = self.create_room(fmt, points=5)
                self.assertEqual(res.status_code, 201, res.data)
                room = AORoom.objects.get(pk=res.data["id"])
                self.assertEqual([q.points for q in room.questions.all()], [1])

    def test_strategic_keeps_chosen_points(self):
        res = self.create_room(AORoom.FORMAT_STRATEGIC, points=4)
        self.assertEqual(res.status_code, 201, res.data)
        room = AORoom.objects.get(pk=res.data["id"])
        self.assertEqual([q.points for q in room.questions.all()], [4])

    def test_points_above_five_rejected(self):
        res = self.create_room(AORoom.FORMAT_STRATEGIC, points=6)
        self.assertEqual(res.status_code, 400)

    def test_random_room_has_no_categories(self):
        res = self.create_room(AORoom.FORMAT_RANDOM, points=1)
        self.assertEqual(res.data["categories"], [])
        room = AORoom.objects.get(pk=res.data["id"])
        self.assertEqual(room.categories.count(), 0)
        self.assertEqual(room.questions.filter(category__isnull=True).count(), 1)


class PrivateRoomVisibilityTests(APITestCase):
    """Приватная комната не видна в списке: её находят по названию целиком или открывают по ссылке."""

    def setUp(self):
        self.author = User.objects.create_user(username="author", email="author@test.local", password="pwd12345")
        self.other = User.objects.create_user(username="other", email="other@test.local", password="pwd12345")
        self.private = AORoom.objects.create(
            title="Секретный квиз", format=AORoom.FORMAT_RANDOM, author=self.author, is_public=False
        )
        Question.objects.create(room=self.private, text="2+2?", answer="4", points=1)
        AORoom.objects.create(
            title="Открытый квиз", format=AORoom.FORMAT_RANDOM, author=self.author, is_public=True
        )

    def titles(self, **params):
        res = self.client.get("/api/rooms/", params)
        self.assertEqual(res.status_code, 200)
        return [r["title"] for r in res.data]

    # Регистр в тестах совпадает с названием: на SQLite поиск без учёта регистра
    # работает только для латиницы, на боевом PostgreSQL — для кириллицы тоже
    def test_hidden_from_list_and_from_partial_search(self):
        self.client.force_authenticate(self.other)
        self.assertNotIn("Секретный квиз", self.titles())
        self.assertNotIn("Секретный квиз", self.titles(search="Секрет"))

    def test_found_by_full_title(self):
        self.client.force_authenticate(self.other)
        self.assertIn("Секретный квиз", self.titles(search="Секретный квиз"))

    def test_opens_by_direct_link_for_anyone(self):
        self.client.force_authenticate(self.other)
        res = self.client.get(f"/api/rooms/{self.private.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["title"], "Секретный квиз")

    def test_author_sees_own_private_room_in_list(self):
        self.client.force_authenticate(self.author)
        self.assertIn("Секретный квиз", self.titles(show="mine"))
