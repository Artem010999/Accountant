"""PPTX: python-pptx. Каждый слайд — отдельная страница (для traceability «взято со слайда N»)."""

from pptx import Presentation


def extract_pages(path: str) -> list[tuple[int, str]]:
    prs = Presentation(path)
    pages: list[tuple[int, str]] = []
    for number, slide in enumerate(prs.slides, start=1):
        texts: list[str] = []
        for shape in slide.shapes:
            if shape.has_text_frame and shape.text_frame.text.strip():
                texts.append(shape.text_frame.text.strip())
            if getattr(shape, "has_table", False) and shape.has_table:
                for row in shape.table.rows:
                    cells = [c.text.strip() for c in row.cells if c.text.strip()]
                    if cells:
                        texts.append(" | ".join(cells))
        pages.append((number, "\n".join(texts)))
    return pages
