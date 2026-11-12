-- ТОЛЬКО для локального стека (Docker Compose). Имитирует то, что Supabase создаёт сам:
-- схему auth, таблицу auth.users, функцию auth.uid() и роли anon / authenticated.
-- Выполняется один раз при инициализации контейнера postgres (docker-entrypoint-initdb.d),
-- до миграций backend/supabase/migrations. На хостед-Supabase не используется.

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY,
    raw_user_meta_data jsonb
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;

DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
