from django.urls import path

from . import views

urlpatterns = [
    path("start/", views.GameStartView.as_view()),
    path("<int:pk>/", views.GameDetailView.as_view()),
    path("<int:pk>/score/", views.GameScoreView.as_view()),
    path("<int:pk>/finish/", views.GameFinishView.as_view()),
]
