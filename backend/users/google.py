"""Вход и регистрация через Google (Google Identity Services, ID-токен)."""
import re
import uuid

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from core.images import AVATAR_MAX_SIDE, shrink_image
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

User = get_user_model()


class GoogleAuthError(Exception):
    pass


def verify_credential(credential: str) -> dict:
    """Проверяет подпись, срок действия и получателя ID-токена Google. Возвращает его данные."""
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleAuthError("Вход через Google не настроен на сервере.")
    try:
        info = id_token.verify_oauth2_token(credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID)
    except ValueError as e:
        raise GoogleAuthError("Недействительный токен Google.") from e
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise GoogleAuthError("Недействительный токен Google.")
    if not info.get("email") or not info.get("email_verified"):
        raise GoogleAuthError("Email в аккаунте Google не подтверждён.")
    return info


def _unique_username(email: str, name: str) -> str:
    base = re.sub(r"[^\w.+-]", "", email.split("@")[0])[:30] or re.sub(r"[^\w]", "", name)[:30] or "user"
    if len(base) < 3:
        base = f"{base}user"
    candidate, n = base, 1
    while User.objects.filter(username__iexact=candidate).exists():
        n += 1
        candidate = f"{base}{n}"
    return candidate


def _save_picture(user, url: str):
    """Скачивает аватар из Google (если у пользователя ещё нет своего). Ошибки не критичны."""
    if not url or user.avatar:
        return
    # Google по умолчанию отдаёт 96×96 — в кружке профиля на 120 px это каша.
    # Размер задаётся суффиксом в самой ссылке, просим покрупнее.
    url = re.sub(r"=s\d+(-c)?$", f"=s{AVATAR_MAX_SIDE}-c", url)
    try:
        r = requests.get(url, timeout=5)
        if r.ok and r.headers.get("content-type", "").startswith("image/"):
            name = f"google_{uuid.uuid4().hex[:10]}.jpg"
            content, shrunk_name = shrink_image(ContentFile(r.content), AVATAR_MAX_SIDE, name)
            user.avatar.save(shrunk_name or name, content or ContentFile(r.content), save=True)
    except requests.RequestException:
        pass


def get_or_create_user(info: dict):
    """Находит пользователя по Google ID или email, иначе создаёт нового. Возвращает (user, created)."""
    sub, email = info["sub"], info["email"].lower()

    user = User.objects.filter(google_sub=sub).first()
    created = False
    if user is None:
        # Уже есть аккаунт с этим email (регистрировался паролем) — привязываем Google к нему
        user = User.objects.filter(email__iexact=email).first()
        if user is not None:
            user.google_sub = sub
            user.save(update_fields=["google_sub"])
        else:
            user = User(
                username=_unique_username(email, info.get("name", "")),
                email=email,
                first_name=info.get("given_name", "")[:150],
                last_name=info.get("family_name", "")[:150],
                google_sub=sub,
            )
            user.set_unusable_password()
            user.save()
            created = True
        _save_picture(user, info.get("picture", ""))

    if not user.is_active:
        raise GoogleAuthError("Аккаунт заблокирован.")
    return user, created
