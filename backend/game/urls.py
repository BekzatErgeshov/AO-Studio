from django.urls import path

from . import live, views

urlpatterns = [
    path("start/", views.GameStartView.as_view()),
    path("<int:pk>/", views.GameDetailView.as_view()),
    path("<int:pk>/score/", views.GameScoreView.as_view()),
    path("<int:pk>/finish/", views.GameFinishView.as_view()),
    # Онлайн: ведущий
    path("<int:pk>/state/", views.GameStateView.as_view()),
    path("<int:pk>/begin/", views.GameBeginView.as_view()),
    path("<int:pk>/teams/<int:team_id>/", views.GameTeamDeleteView.as_view()),
    path("<int:pk>/answers/", views.GameAnswersView.as_view()),
]

# Онлайн: команды (подключаются в config/urls.py под /api/live/)
live_urlpatterns = [
    path("<str:code>/", live.LiveStateView.as_view()),
    path("<str:code>/join/", live.LiveJoinView.as_view()),
    path("<str:code>/answer/", live.LiveAnswerView.as_view()),
    path("<str:code>/pick/", live.LivePickView.as_view()),
]
