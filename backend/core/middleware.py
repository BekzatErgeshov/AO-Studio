from django.conf import settings
from django.http import HttpResponsePermanentRedirect


class LocalhostRedirectMiddleware:
    """В режиме разработки перенаправляет 127.0.0.1 → localhost.

    Google Sign-In принимает только origin http://localhost:<порт>, адрес 127.0.0.1 даёт origin_mismatch.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if settings.DEBUG:
            host = request.get_host()
            if host == "127.0.0.1" or host.startswith("127.0.0.1:"):
                return HttpResponsePermanentRedirect(
                    f"{request.scheme}://localhost{host[len('127.0.0.1'):]}{request.get_full_path()}"
                )
        return self.get_response(request)
