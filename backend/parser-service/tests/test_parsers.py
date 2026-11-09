from pathlib import Path

import pymupdf
from docx import Document
from fastapi.testclient import TestClient
from pptx import Presentation

from app.hashing import sha256_file
from app.main import app
from app.parsers import build_response, parse_document
from app.models import ParseRequest

client = TestClient(app)


def _uri(path: Path) -> str:
    return path.as_uri()


def _assert_offsets(resp) -> None:
    """Смещения страниц должны точно указывать на текст в extracted_text (ТЗ 3.6, п. 1)."""
    for page in resp.metadata.pages:
        assert resp.extracted_text[page.char_start : page.char_end] == page.text


def test_health() -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_docx_paragraphs_and_table(tmp_path: Path) -> None:
    path = tmp_path / "plan.docx"
    doc = Document()
    doc.add_paragraph("Проблема: студенты тратят время на поиск попутчиков.")
    table = doc.add_table(rows=1, cols=2)
    table.cell(0, 0).text = "Метрика"
    table.cell(0, 1).text = "Значение"
    doc.save(path)

    resp = parse_document(ParseRequest(file_name="plan.docx", file_url=_uri(path)))
    assert resp.sha256_hash == sha256_file(str(path))
    assert "студенты тратят время" in resp.extracted_text
    assert "Метрика | Значение" in resp.extracted_text
    assert resp.metadata.total_pages == 1


def test_pptx_one_page_per_slide(tmp_path: Path) -> None:
    path = tmp_path / "deck.pptx"
    prs = Presentation()
    for title in ("Первый слайд про проблему", "Второй слайд про решение"):
        slide = prs.slides.add_slide(prs.slide_layouts[5])
        slide.shapes.title.text = title
    prs.save(path)

    resp = parse_document(ParseRequest(file_name="deck.pptx", file_url=_uri(path)))
    assert resp.metadata.total_pages == 2
    assert resp.metadata.pages[1].text == "Второй слайд про решение"
    _assert_offsets(resp)


def test_pdf_text_layer(tmp_path: Path) -> None:
    path = tmp_path / "doc.pdf"
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_text((72, 72), "Hello passport: this page has a text layer for parsing tests.")
    pdf.new_page().insert_text((72, 72), "Second page with another enough sentence to pass threshold.")
    pdf.save(path)
    pdf.close()

    resp = parse_document(ParseRequest(file_name="doc.pdf", file_url=_uri(path)))
    assert resp.metadata.total_pages == 2
    assert "Hello passport" in resp.metadata.pages[0].text
    _assert_offsets(resp)


def test_offsets_with_separator() -> None:
    resp = build_response("a" * 64, [(1, "абв"), (2, "где")])
    assert resp.extracted_text == "абв\n\nгде"
    assert (resp.metadata.pages[1].char_start, resp.metadata.pages[1].char_end) == (5, 8)
    _assert_offsets(resp)


def test_http_parse_docx(tmp_path: Path) -> None:
    path = tmp_path / "x.docx"
    doc = Document()
    doc.add_paragraph("Текст для проверки HTTP-эндпоинта парсера.")
    doc.save(path)
    res = client.post("/parse", json={"file_name": "x.docx", "file_url": _uri(path)})
    assert res.status_code == 200
    assert len(res.json()["sha256_hash"]) == 64


def test_unsupported_format_415(tmp_path: Path) -> None:
    path = tmp_path / "x.txt"
    path.write_text("text", encoding="utf-8")
    res = client.post("/parse", json={"file_name": "x.txt", "file_url": _uri(path)})
    assert res.status_code == 415


def test_missing_file_404(tmp_path: Path) -> None:
    res = client.post("/parse", json={"file_name": "x.pdf", "file_url": _uri(tmp_path / "nope.pdf")})
    assert res.status_code == 404
