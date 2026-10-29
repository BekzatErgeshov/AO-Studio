"""Приведение загружаемых изображений к разумному размеру.

Зачем: телефон отдаёт снимок вроде 3120×4208, а аватар показывается кружком 120 px.
Браузер ужимает такую картинку в 26 раз и на таком масштабе заметно мылит — поэтому
уменьшаем сами, качественным фильтром. Заодно не таскаем по сети лишние три мегабайта
на каждую отрисовку аватара.

Попутно разворачиваем снимок по EXIF: телефоны пишут ориентацию отдельным тегом, и без
этого портрет уезжает набок.
"""
from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

#: Длинная сторона аватара после обработки. 512 с запасом хватает: самый крупный показ —
#: 120 px, а на экранах с удвоенной плотностью это 240.
AVATAR_MAX_SIDE = 512

#: Форматы, которые сохраняем как есть. Остальное (HEIC, BMP, TIFF…) переводим в JPEG.
KEEP_FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}


def shrink_image(file, max_side: int, name: str):
    """Уменьшает картинку до `max_side` по длинной стороне и возвращает (ContentFile, имя).

    Если файл меньше — только разворачиваем по EXIF и пересохраняем. Картинку не растягиваем:
    маленький аватар из Google от этого чётче не станет.

    При любой ошибке разбора возвращает (None, None) — вызывающий код сохраняет оригинал,
    и загрузка не падает из-за неподдерживаемого формата.
    """
    try:
        file.seek(0)
        image = Image.open(file)
        image = ImageOps.exif_transpose(image)
        fmt = (image.format or "JPEG").upper()
        if fmt not in KEEP_FORMATS:
            fmt = "JPEG"
        # Прозрачность переживает только PNG и WEBP; при переводе в JPEG кладём на белый фон
        if fmt == "JPEG" and image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGBA")
            background = Image.new("RGB", image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[-1])
            image = background
        elif image.mode not in ("RGB", "RGBA", "L"):
            image = image.convert("RGB")

        if max(image.size) > max_side:
            image.thumbnail((max_side, max_side), Image.LANCZOS)

        buffer = BytesIO()
        save_kwargs = {"optimize": True}
        if fmt in ("JPEG", "WEBP"):
            save_kwargs["quality"] = 90
        image.save(buffer, format=fmt, **save_kwargs)
    except (OSError, ValueError, Image.DecompressionBombError):
        return None, None

    stem = name.rsplit(".", 1)[0] or "image"
    return ContentFile(buffer.getvalue()), f"{stem}.{KEEP_FORMATS[fmt]}"
