"""PDF: PyMuPDF. Страница с текстом короче порога и картинками → OCR."""

import pymupdf  # PyMuPDF

from app.parsers.ocr import ocr_page_image

MIN_TEXT_CHARS = 30


def extract_pages(path: str) -> list[tuple[int, str]]:
    pages: list[tuple[int, str]] = []
    with pymupdf.open(path) as doc:
        for number, page in enumerate(doc, start=1):
            text = page.get_text("text").strip()
            if len(text) < MIN_TEXT_CHARS and page.get_images():
                pix = page.get_pixmap(dpi=200)
                text = ocr_page_image(pix.tobytes("png")).strip() or text
            pages.append((number, text))
    return pages
