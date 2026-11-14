-- Блок 4: блокировка от двойного запуска, журнал обращений к LLM, история ИИ-Консультанта, выгрузки DOCX.
-- Отдельная миграция: 0001–0008 уже в истории. История чата консультанта — в 0008_consultant_chat (отдельно). Не идемпотентна (как и остальные).

-- 1) Блокировка от двойного запуска (пользователь = проект). Зависшая блокировка (> 10 минут) снимается кодом.
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

-- 2) Журнал обращений к нейросети. Служебная таблица: клиентам недоступна (RLS без политик).
CREATE TABLE llm_call_log (
    id                bigserial PRIMARY KEY,
    user_id           uuid REFERENCES app_profiles(id) ON DELETE SET NULL,
    task              text NOT NULL,
    model             text,
    status            text NOT NULL CHECK (status IN ('ok', 'error')),
    duration_ms       int NOT NULL CHECK (duration_ms >= 0),
    error_message     text,
    response_preview  text,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_llm_call_log_created ON llm_call_log(created_at);
ALTER TABLE llm_call_log ENABLE ROW LEVEL SECURITY;

-- 4) Выгрузки паспорта в DOCX. Содержимое — в БД; скачивание только владельцу.
CREATE TABLE passport_exports (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid NOT NULL REFERENCES app_projects(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
    file_name   text NOT NULL,
    sha256      text NOT NULL,
    content     bytea NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_passport_exports_user ON passport_exports(user_id);
ALTER TABLE passport_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY passport_exports_owner ON passport_exports
FOR SELECT TO authenticated USING (user_id = auth.uid());
