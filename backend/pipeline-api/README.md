# pipeline-api (v1.0)

HTTP-сервис пайплайна «Конструктора Паспорта»: файлы → LLM → паспорт → статусы → выход.
Реализует блоки 1–5 ТЗ v1.8 (аналог n8n-графа) в коде, с тестами.

## Эндпоинты

| Метод | Путь | Описание |
|---|---|---|
| GET | `/health` | проверка живости |
| POST | `/pipeline` | единый вход (контракт `packages/contracts/src/pipeline.ts`) |

Заголовок `x-pipeline-secret` обязателен, если задан `PIPELINE_SHARED_SECRET`.
Ошибки: `400` — схема запроса, `401` — секрет, `422` — ожидаемая ошибка пайплайна (`status: "ERROR"`, `code`), `500` — внутренняя.

## Состояния ответа

`WAITING_FOR_INITIAL_BRIEF` · `NEED_USER_INPUT` · `ANSWER_REJECTED` · `STOP_NOV` · `BLOCKED_PROJECT_SWAP` · `COMPLETED` · `ERROR`

## Запуск

```bash
# 1. миграции (чистая БД; DEV_SEED=1 добавляет тестовые данные)
SUPABASE_DB_URL=postgres://... DEV_SEED=1 npm run migrate -w @passport/pipeline-api
# 2. сервисы
PARSER_URL=http://localhost:8000 SUPABASE_DB_URL=... OPENAI_API_KEY=... npm run start:pipeline
```

## Тесты

Из корня: `npm test` (vitest). БД для тестов — PGlite (Postgres в процессе) с теми же миграциями;
pgcrypto пропускается (в PGlite недоступен, `gen_random_uuid()` встроенный).
Парсер: `cd backend/parser-service && python -m pytest`.

## Ограничения v1.0

- Нет блокировки на проект: два параллельных запроса одного пользователя могут гоняться (нужен advisory lock).
- Нет JWT-проверки: `user_id` доверяется шлюзу (в проде — Supabase JWT на Edge/шлюзе).
- Программа одна: «Студенческий стартап» (манифест `backend/kb/programs/student-startup`).
- `replaceClaims` и триггеры построчные; батчевый пересчёт — в backlog.
- Качество ответов LLM зависит от промптов из ТЗ; на реальном ключе не прогонялось (в тестах — FakeLlm).
