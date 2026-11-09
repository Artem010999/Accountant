# Конструктор Паспорта Проекта — v1.0

Monorepo по ТЗ «Бэкенд и пайплайн Конструктора Паспорта Проекта (MVP v1.8)».
Пайплайн работает с файлами (PDF/DOCX/PPTX, OCR) и LLM (извлечение, валидация ответов, новизна, навигатор).

Архитектура и решения: [docs/architecture.md](docs/architecture.md).

## Структура

- `backend/pipeline-api/` — оркестратор пайплайна (TypeScript): блоки 1–5 ТЗ, LLM, Postgres
- `backend/parser-service/` — парсинг документов и OCR (FastAPI)
- `backend/supabase/` — миграции схемы v1.8 и seed
- `backend/kb/` — вопросы, примеры и правила программы (манифест)
- `packages/passport-core/` — span-расчёт, аудит цитат, Rule Engine
- `packages/contracts/` — enums, реестр секций, контракт `/pipeline`
- `frontend/` — скелет UI (подключение к `/pipeline` — следующий этап)

## Быстрый старт

```bash
cp .env.example .env          # заполнить ключи и строку подключения
npm install
npm test                      # 34 теста: логика, триггеры БД, HTTP-контракт
cd backend/parser-service && python -m pytest && cd ../..

# схема в Postgres/Supabase (чистая БД)
SUPABASE_DB_URL=... DEV_SEED=1 npm run migrate -w @passport/pipeline-api

# сервисы
docker compose up -d parser pipeline     # или: npm run start:pipeline
```

Вход: `POST http://localhost:8080/pipeline`, заголовок `x-pipeline-secret`, тело — `PipelineRequest` (см. `packages/contracts/src/pipeline.ts`).

## Ограничения v1.0

См. раздел 7 в [docs/architecture.md](docs/architecture.md): нет фронтенд-интеграции, нет JWT-проверки на входе, не прогонялось на реальном ключе LLM и Supabase.
