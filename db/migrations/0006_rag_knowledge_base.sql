CREATE TABLE IF NOT EXISTS rag_knowledge_cards (
    card_id TEXT PRIMARY KEY,
    source_doc TEXT NOT NULL CHECK (source_doc IN (
        'StudStartup_Knowledge_Base_v2',
        'Студ_стартап_сравнение_7_и_8',
        'Примеры_КП_нов_Стс_7',
        'TechLead8'
    )),
    source_page TEXT NOT NULL,
    title TEXT NOT NULL,
    authority_status TEXT NOT NULL CHECK (authority_status IN (
        'verified_8',           -- Подтверждено официальным источником 8-й очереди
        'needs_verification_8', -- Пересказ вебинара или правило 7-й очереди, требует сверки с Положением 8-й очереди
        'methodology',          -- Методика подготовки и проверки заявки (не формальное требование ФСИ)
        'example'               -- Учебный пример (запрещено копировать факты и цифры в проект клиента)
    )),
    retrieval_mode TEXT NOT NULL CHECK (retrieval_mode IN ('pinned', 'search')),
    pipeline_steps TEXT[] NOT NULL, -- Допустимые значения: 'assembly', 'audit', 'novelty', 'chat'
    target_blocks TEXT[] NOT NULL,  -- Допустимые значения: '1'..'10', 'all'
    direction TEXT NOT NULL DEFAULT 'all' CHECK (direction IN ('all', 'Н1', 'Н2', 'Н3', 'Н4', 'Н5', 'Н6', 'Н7')),
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,     -- SHA-256 от content для защиты от повторной векторизации неизменённых карточек
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    search_tsv tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('russian', coalesce(content, '')), 'B')
    ) STORED,
    embedding vector(4096),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы для быстрой фильтрации и полнотекстового поиска
-- ВАЖНО: НЕ создавать индекс HNSW или IVFFlat на колонке embedding vector(4096), т.к. pgvector имеет лимит в 2000 измерений!
CREATE INDEX IF NOT EXISTS idx_rag_cards_search_tsv ON rag_knowledge_cards USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS idx_rag_cards_steps ON rag_knowledge_cards USING GIN (pipeline_steps);
CREATE INDEX IF NOT EXISTS idx_rag_cards_blocks ON rag_knowledge_cards USING GIN (target_blocks);
CREATE INDEX IF NOT EXISTS idx_rag_cards_mode ON rag_knowledge_cards (retrieval_mode);
CREATE INDEX IF NOT EXISTS idx_rag_cards_direction ON rag_knowledge_cards (direction);
CREATE INDEX IF NOT EXISTS idx_rag_cards_source_doc ON rag_knowledge_cards (source_doc);
