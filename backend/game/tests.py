from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from rooms.models import AORoom, Question

from .models import GameSession, Team, Violation

User = get_user_model()


class AnticheatTests(APITestCase):
    """Античит онлайн-игры: предупреждение, дисквалификация, заморозка баллов, прощение."""

    def setUp(self):
        self.host = User.objects.create_user(username="host", password="pwd12345")
        self.room = AORoom.objects.create(title="Тест", format="classic", author=self.host)
        self.question = Question.objects.create(room=self.room, text="2+2?", answer="4", points=1)
        self.session = GameSession.objects.create(
            room=self.room,
            host=self.host,
            mode=GameSession.MODE_ONLINE,
            status=GameSession.STATUS_LOBBY,
            code="ABC123",
            anticheat=True,
        )

    def join(self, name="Ала-Тоо"):
        res = self.client.post(f"/api/live/{self.session.code}/join/", {"name": name}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        return res.data["token"]

    def begin(self):
        """Ведущий начал игру и открыл приём ответов на вопрос."""
        self.session.status = GameSession.STATUS_ACTIVE
        self.session.state = {"view": "question", "accepting": True, "question": {"id": self.question.id}}
        self.session.save(update_fields=["status", "state"])

    def violate(self, token, kind="hidden"):
        return self.client.post(
            f"/api/live/{self.session.code}/violation/",
            {"kind": kind},
            format="json",
            headers={"X-Team-Token": token},
        )

    def test_first_violation_warns_second_disqualifies(self):
        token = self.join()
        self.begin()

        res = self.violate(token)
        self.assertTrue(res.data["counted"])
        self.assertEqual(res.data["warnings"], 1)
        self.assertFalse(res.data["disqualified"], "первое нарушение — только предупреждение")

        # Два события одного ухода с экрана (blur + hidden) не должны стоить двух нарушений
        res = self.violate(token, "blur")
        self.assertFalse(res.data["counted"])
        self.assertEqual(res.data["warnings"], 1)

        # Разводим нарушения по времени — теперь дисквалификация
        Violation.objects.filter(team__token=token).update(at="2020-01-01T00:00:00Z")
        res = self.violate(token, "fullscreen")
        self.assertTrue(res.data["counted"])
        self.assertTrue(res.data["disqualified"])
        self.assertEqual(res.data["dq_reason"], "Вышел из полноэкранного режима")

    def test_disqualified_team_cannot_answer_or_pick(self):
        token = self.join()
        self.begin()
        Team.objects.filter(token=token).update(disqualified=True, dq_reason="Свернул игру")

        res = self.client.post(
            f"/api/live/{self.session.code}/answer/",
            {"question_id": self.question.id, "text": "4"},
            format="json",
            headers={"X-Team-Token": token},
        )
        self.assertEqual(res.status_code, 403)

        res = self.client.post(
            f"/api/live/{self.session.code}/pick/",
            {"question_id": self.question.id},
            format="json",
            headers={"X-Team-Token": token},
        )
        self.assertEqual(res.status_code, 403)

    def test_score_frozen_and_pardon_restores(self):
        token = self.join()
        self.begin()
        team = Team.objects.get(token=token)
        team.score = 5
        team.disqualified = True
        team.warnings = 2
        team.save()

        self.client.force_authenticate(self.host)
        res = self.client.patch(f"/api/game/{self.session.id}/score/", {"team_id": team.id, "delta": 3}, format="json")
        self.assertEqual(res.status_code, 400, "баллы дисквалифицированной команды заморожены")
        team.refresh_from_db()
        self.assertEqual(team.score, 5)

        res = self.client.post(f"/api/game/{self.session.id}/teams/{team.id}/pardon/")
        self.assertEqual(res.status_code, 200)
        team.refresh_from_db()
        self.assertFalse(team.disqualified)
        self.assertEqual(team.warnings, 0)

        res = self.client.patch(f"/api/game/{self.session.id}/score/", {"team_id": team.id, "delta": 3}, format="json")
        self.assertEqual(res.status_code, 200)
        team.refresh_from_db()
        self.assertEqual(team.score, 8)

    def test_no_violations_in_lobby_or_with_anticheat_off(self):
        token = self.join()
        # Игра ещё не началась — телефон свободен
        res = self.violate(token)
        self.assertFalse(res.data["counted"])

        self.begin()
        self.session.anticheat = False
        self.session.save(update_fields=["anticheat"])
        res = self.violate(token)
        self.assertFalse(res.data["counted"], "при выключенном античите нарушения не считаются")
        self.assertEqual(Violation.objects.count(), 0)

    def test_beacon_sends_token_in_body(self):
        """Уход со страницы отправляется через sendBeacon — заголовки там недоступны."""
        token = self.join()
        self.begin()
        res = self.client.post(
            f"/api/live/{self.session.code}/violation/",
            {"kind": "left", "token": token},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["counted"])
        self.assertEqual(res.data["warnings"], 1)

    def test_team_and_host_see_anticheat_state(self):
        token = self.join()
        self.begin()
        self.violate(token)

        # Устройство команды видит свои предупреждения
        res = self.client.get(f"/api/live/{self.session.code}/", headers={"X-Team-Token": token})
        self.assertTrue(res.data["anticheat"])
        self.assertEqual(res.data["me"]["warnings"], 1)
        self.assertFalse(res.data["me"]["disqualified"])

        # Ведущий видит журнал нарушений
        self.client.force_authenticate(self.host)
        res = self.client.get(f"/api/game/{self.session.id}/anticheat/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["violations"]), 1)
        self.assertEqual(res.data["violations"][0]["kind"], "hidden")
        self.assertEqual(res.data["teams"][0]["warnings"], 1)


class BoardLaunchTests(APITestCase):
    """Запуск с доски: ожидаемый состав, лимит мест и автостарт по сбору всех команд."""

    def setUp(self):
        self.host = User.objects.create_user(username="host", password="pwd12345")
        self.room = AORoom.objects.create(title="Тест", format="classic", author=self.host)
        Question.objects.create(room=self.room, text="2+2?", answer="4", points=1)

    def start_board(self, **extra):
        self.client.force_authenticate(self.host)
        payload = {
            "room_id": self.room.id,
            "mode": "online",
            "board": True,
            "expected_teams": 2,
            "team_size": 4,
            "autostart": True,
            "timer_duration": 90,
            "teams": [],
        }
        payload.update(extra)
        res = self.client.post("/api/game/start/", payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.client.force_authenticate(None)
        return res.data

    def join(self, code, name):
        return self.client.post(f"/api/live/{code}/join/", {"name": name}, format="json")

    def test_board_settings_saved_and_returned(self):
        data = self.start_board()
        self.assertTrue(data["board"])
        self.assertTrue(data["autostart"])
        self.assertEqual(data["expected_teams"], 2)
        self.assertEqual(data["team_size"], 4)
        self.assertEqual(data["timer_duration"], 90)
        self.assertEqual(data["status"], "lobby")

        # Команда видит ожидаемый состав ещё до входа
        res = self.client.get(f"/api/live/{data['code']}/")
        self.assertEqual(res.data["expected_teams"], 2)
        self.assertEqual(res.data["team_size"], 4)

    def test_autostart_when_all_teams_joined(self):
        data = self.start_board()
        code = data["code"]

        self.assertEqual(self.join(code, "Первая").status_code, 201)
        self.assertEqual(GameSession.objects.get(pk=data["id"]).status, GameSession.STATUS_LOBBY)

        self.assertEqual(self.join(code, "Вторая").status_code, 201)
        session = GameSession.objects.get(pk=data["id"])
        self.assertEqual(session.status, GameSession.STATUS_ACTIVE, "собрались все — игра начинается сама")
        self.assertEqual(session.state, {"view": "waiting"})

    def test_join_refused_when_all_places_taken(self):
        data = self.start_board(autostart=False)
        code = data["code"]
        self.join(code, "Первая")
        self.join(code, "Вторая")

        res = self.join(code, "Третья")
        self.assertEqual(res.status_code, 400)
        self.assertIn("мест", res.data["detail"])
        self.assertEqual(Team.objects.filter(session_id=data["id"]).count(), 2)

    def test_without_autostart_host_starts_manually(self):
        data = self.start_board(autostart=False)
        self.join(data["code"], "Первая")
        self.join(data["code"], "Вторая")
        self.assertEqual(GameSession.objects.get(pk=data["id"]).status, GameSession.STATUS_LOBBY)

        self.client.force_authenticate(self.host)
        res = self.client.patch(f"/api/game/{data['id']}/begin/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(GameSession.objects.get(pk=data["id"]).status, GameSession.STATUS_ACTIVE)
