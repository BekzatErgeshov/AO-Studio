from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.http import require_GET


@require_GET
def spa(request, *args, **kwargs):
    """Отдаёт index.html React-приложения для всех «страничных» адресов (/, /rooms, /profile …)."""
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        return HttpResponse(
            "<h2>Фронтенд не собран</h2><p>Запустите <code>python manage.py runserver</code> "
            "(соберёт автоматически) или <code>npm run build</code> в папке frontend.</p>",
            status=503,
        )
    response = HttpResponse(index.read_bytes(), content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "no-cache"
    return response
