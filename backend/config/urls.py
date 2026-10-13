from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from core.views import spa

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("users.urls")),
    path("api/game/", include("game.urls")),
    path("api/", include("rooms.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # Простая раздача медиа в продакшене (для Railway volume / небольших нагрузок)
    urlpatterns += [re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT})]

# Всё остальное — страницы React-приложения (должно быть последним)
urlpatterns += [re_path(r"^(?!api/|admin|media/|static/).*$", spa)]
