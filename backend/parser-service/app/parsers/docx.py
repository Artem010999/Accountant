"""DOCX: python-docx. Постраничной разбивки нет — весь документ как страница 1 (абзацы и таблицы)."""

from docx import Document


def extract_pages(path: str) -> list[tuple[int, str]]:
    doc = Document(path)
    parts = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                parts.append(" | ".join(cells))
    return [(1, "\n".join(parts))]
