-- v1.1, блок 1: анкета допуска (статус отказа), смета, поля КП и технологического вызова, лимиты сметы.
-- Миграция не идемпотентна (как и остальные): применяется на чистую или уже мигрированную до 0006 БД.

-- 1) Финальный отказ на входе
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'rejected';

-- 2) Ответы на анкету допуска (jsonb: ключ вопроса → true/false)
ALTER TABLE app_projects ADD COLUMN IF NOT EXISTS eligibility_answers jsonb;

-- 3) Смета: статьи по группам, как в описании расходов 8-й очереди
--    salary — оплата труда (лимит в месяц); equipment — оборудование (лимит за единицу);
--    ip_and_premises — ИС, лицензии на РИД, производственные помещения;
--    contractor — сторонние исполнители (лимит на сумму всех работ); other — иные расходы.
CREATE TYPE budget_category AS ENUM ('salary', 'equipment', 'ip_and_premises', 'contractor', 'other');

CREATE TABLE project_budget_items (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id        uuid NOT NULL REFERENCES app_projects(id) ON DELETE CASCADE,
    stage             smallint NOT NULL CHECK (stage IN (1, 2)),
    category          budget_category NOT NULL,
    title             text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
    quantity          numeric(14, 2) NOT NULL CHECK (quantity > 0),
    unit_price        numeric(14, 2) NOT NULL CHECK (unit_price >= 0),
    amount            numeric(14, 2) NOT NULL CHECK (amount >= 0),
    justification     text NOT NULL DEFAULT '',
    -- как у полей паспорта: needs_review ставит карта зависимостей (задача 1.5)
    review_status     record_review_status NOT NULL DEFAULT 'draft',
    order_index       int NOT NULL DEFAULT 0,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_budget_items_project ON project_budget_items(project_id);

ALTER TABLE project_budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_budget_items_owner ON project_budget_items
FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM app_projects p WHERE p.id = project_budget_items.project_id AND p.user_id = auth.uid())
);

-- 4) Лимиты сметы: динамические, одна активная редакция. Меняются записью в таблицу (админка — отдельный этап).
--    Значения по умолчанию — из презентации эксперта по 8-й очереди (стр. 5 и 19–21 PDF). Это не положение:
--    перед использованием сверить с Положением Pol_StS_8 и договором.
CREATE TABLE budget_limit_sets (
    id                        serial PRIMARY KEY,
    is_active                 boolean NOT NULL DEFAULT false,
    total                     numeric(14, 2) NOT NULL,
    stage_1_max               numeric(14, 2) NOT NULL,
    stage_2_max               numeric(14, 2) NOT NULL,
    contractor_total_max      numeric(14, 2) NOT NULL,
    equipment_unit_price_max  numeric(14, 2) NOT NULL,
    salary_monthly_max        numeric(14, 2) NOT NULL,
    source                    text NOT NULL,
    created_at                timestamptz NOT NULL DEFAULT now()
);

-- не больше одной активной редакции
CREATE UNIQUE INDEX one_active_budget_limit_set ON budget_limit_sets (is_active) WHERE is_active;

ALTER TABLE budget_limit_sets ENABLE ROW LEVEL SECURITY; -- без политик: клиентам недоступна, бэкенд читает под сервисной ролью

INSERT INTO budget_limit_sets (is_active, total, stage_1_max, stage_2_max, contractor_total_max,
                               equipment_unit_price_max, salary_monthly_max, source)
VALUES (true, 1000000, 20000, 980000, 250000, 150000, 100000,
        'Презентация эксперта «Очередь 8» (стр. 5 и 19–21 PDF). Не положение: сверить с Pol_StS_8 и договором.');
