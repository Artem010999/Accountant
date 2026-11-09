"""OCR сканов через Tesseract (pytesseract). Нет бинарника/пакета — возвращает пустую строку, без падения."""

import io
import logging

log = logging.getLogger(__name__)


def ocr_page_image(image_bytes: bytes, lang: str = "rus+eng") -> str:
    try:
        import pytesseract
        from PIL import Image

        return pytesseract.image_to_string(Image.open(io.BytesIO(image_bytes)), lang=lang)
    except Exception as exc:  # tesseract не установлен или не распознал
        log.warning("OCR недоступен: %s", exc)
        return ""
