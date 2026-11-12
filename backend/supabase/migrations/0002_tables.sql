-- ТЗ v1.8, раздел 3.2 (п. 2–7). Задача 1.2. Таблицы (ТЗ пишет «11», перечисляет 12 — включая project_claims).
-- Отличия от ТЗ, добавленные в v1.0 (помечены «v1.0»).

-- 2. ЯДРО ПРИЛОЖЕНИЯ
CREATE TABLE app_profiles (
    id uuid PRIMARY KEY,                                   -- 1:1 с auth.users.id
    founder_data jsonb NOT NULL DEFAULT '{}'::jsonb,       -- Блок 1 паспорта (ФИО, статус обучения, ...)
    role varchar NOT NULL DEFAULT 'user',
    is_banned boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE app_projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES app_profiles(id) ON DELETE CASCADE,  -- 1 юзер = 1 проект
    title varchar NOT NULL DEFAULT 'Мой проект',
    brief_text text NOT NULL,                              -- может быть '' до первого брифа (Баг №1)
    anchor_summary text,
    anchor_embedding vector(4096),
    anchor_status anchor_status NOT NULL DEFAULT 'pending',
    anchor_model varchar,
    anchor_generated_at timestamp with time zone,
    status project_status NOT NULL DEFAULT 'draft',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE app_settings (
    id int PRIMARY KEY DEFAULT 1,
    guard_threshold_block float NOT NULL DEFAULT 0.5,
    guard_threshold_warn float NOT NULL DEFAULT 0.75,
    embedding_model varchar NOT NULL DEFAULT 'qwen3-embedding-8b',
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT app_settings_singleton_chk CHECK (id = 1)
);

-- 3. СОДЕРЖИМОЕ ПРОЕКТА
CREATE TABLE project_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES app_projects(id) ON DELETE CASCADE,
    file_name varchar NOT NULL,
    file_url text NOT NULL,
    sha256_hash varchar(64) NOT NULL,
    extracted_text text,
    metadata jsonb DEFAULT '{}'::jsonb,                    -- {total_pages, pages:[{page,text,char_start,char_end}]}
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT uq_project_source_sha UNIQUE (project_id, sha256_hash)   -- v1.0: дедуп файла внутри проекта
);

CREATE TABLE project_passport_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES app_projects(id) ON DELETE CASCADE,
    section_id int NOT NULL CHECK (section_id BETWEEN 0 AND 10),   -- 0 = служебные записи (навигатор, счетчики)
    field_key varchar NOT NULL,
    value text,
    review_status record_review_status NOT NULL DEFAULT 'draft',
    reviewed_by uuid REFERENCES app_profiles(id) ON DELETE SET NULL,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT uq_project_section_field UNIQUE (project_id, section_id, field_key)
);

CREATE TABLE project_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id uuid NOT NULL REFERENCES project_passport_records(id) ON DELETE CASCADE,
    claim_text text NOT NULL,
    claim_type claim_type NOT NULL DEFAULT 'hypothesis',
    claim_kind varchar,
    source_id uuid REFERENCES project_sources(id) ON DELETE SET NULL,
    source_locator jsonb,                                  -- {"page": N, "quote": "..."}
    span_start int,                                        -- 0-based
    span_end int,
    order_index int,
    confidence float,
    verification_status claim_verification_status NOT NULL DEFAULT 'unverified',
    verified_by uuid REFERENCES app_profiles(id) ON DELETE SET NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_project_claims_record_span ON project_claims (record_id, span_start);
CREATE INDEX idx_project_claims_record_status ON project_claims (record_id, verification_status);

CREATE TABLE project_guard_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES app_projects(id) ON DELETE CASCADE,
    action guard_action NOT NULL,
    similarity_score float NOT NULL,
    anchor_model varchar,
    input_preview text,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. БИЛЛИНГ
CREATE TABLE billing_plans (
    id varchar PRIMARY KEY,
    name varchar NOT NULL,
    price_rub int NOT NULL DEFAULT 0,
    duration_days int NOT NULL DEFAULT 30,
    description text,
    file_uploads_limit int NOT NULL DEFAULT 0,
    renewal_discount_percent int NOT NULL DEFAULT 0,
    features jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE billing_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
    plan_id varchar NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE billing_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
    plan_id varchar NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
    amount_rub int NOT NULL,
    discount_percent int DEFAULT 0,
    status payment_status DEFAULT 'pending',
    provider payment_provider NOT NULL DEFAULT 'yookassa',
    provider_payment_id varchar,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    paid_at timestamp with time zone,
    CONSTRAINT uq_provider_payment UNIQUE (provider, provider_payment_id)
);

-- 5. БАЗА ЗНАНИЙ И АУДИТ
-- v1.0: правила и вопросы живут в backend/kb/programs/*/manifest.json (Вопрос 1, вариант А).
-- Таблица kb_documents хранит метаданные PDF-регламентов.
CREATE TABLE kb_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program varchar NOT NULL,
    doc_type varchar NOT NULL,
    s3_key varchar NOT NULL,
    sha256_hash varchar(64) NOT NULL,
    version varchar NOT NULL DEFAULT '1.0',
    valid_from date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE admin_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES app_profiles(id) ON DELETE SET NULL,
    target_user_id uuid NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
    action admin_action NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
