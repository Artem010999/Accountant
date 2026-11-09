# n8n (опционально)

В v1.0 логика пайплайна живёт в `backend/pipeline-api` (код, тесты, те же блоки 1–5 ТЗ).
n8n не обязателен: его можно использовать как оркестратор поверх того же контракта —
HTTP Request node → `POST {PIPELINE_URL}/pipeline` с заголовком `x-pipeline-secret`.

Карта блоков ТЗ → модули `backend/pipeline-api/src`:

| Блок ТЗ | Модуль |
|---|---|
| 1. Анти-фрод и квота (S1, G1, S1_NEW, S2, G2) | `pipeline/handler.ts`, `db/store.ts` (`loadContext`, `guardCheck`) |
| 2. Входные данные (G3, S3A, S3B) | `pipeline/intake.ts`, ветка U_INIT в `handler.ts` |
| 3. Экстрактор и аудит (ШАГ 4, 5) | `pipeline/passport.ts` (`extractPassport`, `writeClaims`), `passport-core` |
| 4. Пробелы и новизна (G4, S6A, S6B, G5, S7, G6) | `pipeline/passport.ts` (`findGaps`, `answerField`), `pipeline/finalize.ts` |
| 5. Скоринг и выход (S8A, S8B) | `pipeline/finalize.ts`, `passport-core/rules.ts` |

Workflow-JSON для n8n при необходимости экспортировать в `workflows/` (без секретов).
