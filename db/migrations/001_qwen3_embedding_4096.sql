-- Очищаем старые 1536-мерные векторы, так как они несовместимы с 4096-мерными
UPDATE app_projects SET anchor_embedding = NULL;

-- Меняем размерность колонки на 4096
ALTER TABLE app_projects
ALTER COLUMN anchor_embedding TYPE vector(4096);

-- Добавляем колонку embedding_model, если ее еще нет, и обновляем модель эмбеддингов в настройках
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS embedding_model varchar NOT NULL DEFAULT 'qwen3-embedding-8b';
UPDATE app_settings
SET embedding_model = 'qwen3-embedding-8b';
