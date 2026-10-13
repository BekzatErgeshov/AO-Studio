"""Хранилище загружаемых файлов (аватары, фото вопросов) в Vercel Blob.

У серверных функций Vercel нет постоянного диска, поэтому на Vercel файлы
кладутся в Blob через его HTTP API. Включается, когда задан BLOB_READ_WRITE_TOKEN.
"""
import mimetypes
import os
from urllib.parse import quote, unquote, urlparse

import requests
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible

API_URL = "https://blob.vercel-storage.com"
API_VERSION = "7"


@deconstructible
class VercelBlobStorage(Storage):
    def __init__(self, token=None, base_url=None):
        self.token = token or os.environ.get("BLOB_READ_WRITE_TOKEN", "")
        # Токен вида vercel_blob_rw_<storeId>_<secret>; публичный адрес стора — https://<storeid>.public.blob...
        store_id = self.token.split("_")[3] if self.token.count("_") >= 4 else ""
        self.base_url = (base_url or os.environ.get("BLOB_BASE_URL") or f"https://{store_id.lower()}.public.blob.vercel-storage.com").rstrip("/")

    def _headers(self, **extra):
        return {"authorization": f"Bearer {self.token}", "x-api-version": API_VERSION, **extra}

    def _save(self, name, content):
        # Blob добавит суффикс ~31 символ; поле в БД — до 100, поэтому укорачиваем исходное имя
        folder, _, filename = name.rpartition("/")
        stem, dot, ext = filename.rpartition(".")
        if not dot:
            stem, ext = filename, ""
        name = f"{folder + '/' if folder else ''}{stem[:40]}{dot}{ext[:10]}"
        content.seek(0)
        data = content.read()
        ctype = getattr(content, "content_type", None) or mimetypes.guess_type(name)[0] or "application/octet-stream"
        r = requests.put(
            f"{API_URL}/{quote(name)}",
            data=data,
            headers=self._headers(**{"x-content-type": ctype, "x-add-random-suffix": "1"}),
            timeout=30,
        )
        r.raise_for_status()
        # Реальное имя — с суффиксом, который добавил Blob; поле pathname его не содержит
        return unquote(urlparse(r.json()["url"]).path.lstrip("/"))

    def _open(self, name, mode="rb"):
        r = requests.get(self.url(name), timeout=30)
        r.raise_for_status()
        return ContentFile(r.content, name=name)

    def delete(self, name):
        if not name:
            return
        requests.post(f"{API_URL}/delete", json={"urls": [self.url(name)]}, headers=self._headers(), timeout=15)

    def exists(self, name):
        # Имена уникальны за счёт случайного суффикса Blob — коллизий нет
        return False

    def url(self, name):
        return f"{self.base_url}/{quote(name)}"

    def size(self, name):
        r = requests.head(self.url(name), timeout=15)
        return int(r.headers.get("content-length", 0))
