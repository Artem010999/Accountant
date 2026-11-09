"""Parser / OCR сервис (ТЗ 3.6, п. 1). Вызывается из pipeline-api / n8n по внутреннему HTTP (Вопрос 4, вариант А)."""

from fastapi import FastAPI, HTTPException

from app.models import ParseRequest, ParseResponse
from app.parsers import parse_document

app = FastAPI(title="Passport Parser", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/parse", response_model=ParseResponse)
def parse(req: ParseRequest) -> ParseResponse:
    try:
        return parse_document(req)
    except ValueError as exc:  # неподдерживаемый формат или схема URL
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
