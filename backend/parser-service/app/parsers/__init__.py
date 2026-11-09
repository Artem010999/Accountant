"""Диспетчер парсеров: скачать → sha256 → извлечь страницы → собрать ответ с символьными смещениями."""

import os
from pathlib import Path
from typing import Callable

from app.hashing import sha256_file
from app.models import PageText, ParseMetadata, ParseRequest, ParseResponse
from app.parsers import docx, pdf, pptx
from app.storage import fetch_to_local

PAGE_SEPARATOR = "\n\n"

Extractor = Callable[[str], list[tuple[int, str]]]

_EXTRACTORS: dict[str, Extractor] = {
    ".pdf": pdf.extract_pages,
    ".pptx": pptx.extract_pages,
    ".docx": docx.extract_pages,
}


def build_response(sha256: str, pages: list[tuple[int, str]]) -> ParseResponse:
    """Склеивает страницы через PAGE_SEPARATOR; char_start/char_end — 0-based, end не включается."""
    out: list[PageText] = []
    chunks: list[str] = []
    offset = 0
    for i, (number, text) in enumerate(pages):
        if i > 0:
            offset += len(PAGE_SEPARATOR)
        start, end = offset, offset + len(text)
        out.append(PageText(page=number, text=text, char_start=start, char_end=end))
        chunks.append(text)
        offset = end
    return ParseResponse(
        sha256_hash=sha256,
        extracted_text=PAGE_SEPARATOR.join(chunks),
        metadata=ParseMetadata(total_pages=len(pages), pages=out),
    )


def parse_document(req: ParseRequest) -> ParseResponse:
    ext = Path(req.file_name).suffix.lower()
    extractor = _EXTRACTORS.get(ext)
    if extractor is None:
        raise ValueError(f"Формат {ext!r} не поддерживается (нужен PDF, PPTX или DOCX)")

    local_path, is_temp = fetch_to_local(req.file_url, req.file_name)
    try:
        return build_response(sha256_file(local_path), extractor(local_path))
    finally:
        if is_temp:
            os.remove(local_path)
