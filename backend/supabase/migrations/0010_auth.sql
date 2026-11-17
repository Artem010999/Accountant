-- Вход и регистрация по коду из письма (без паролей).
-- Коды и токены сессий хранятся только как HMAC/SHA-256 хеши: сама база не содержит пригодных к использованию кодов.

-- Почта аккаунта (нижний регистр). Аккаунт создаётся при первом подтверждении кода.
ALTER TABLE app_profiles ADD COLUMN IF NOT EXISTS email text UNIQUE;

-- Одноразовые коды входа. purpose: 'user' — вход/регистрация пользователя, 'admin' — вход админа (только существующий admin).
CREATE TABLE IF NOT EXISTS auth_codes (
    id          bigserial PRIMARY KEY,
    email       text NOT NULL,
    purpose     text NOT NULL CHECK (purpose IN ('user', 'admin')),
    code_hash   text NOT NULL,
    expires_at  timestamptz NOT NULL,
    attempts    integer NOT NULL DEFAULT 0,
    consumed    boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_codes_email_created_idx ON auth_codes (email, created_at DESC);

-- Сессии: cookie с токеном, в базе только SHA-256 токена.
CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash  text PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
    expires_at  timestamptz NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id);

-- Админа нельзя создать через API: только вручную в БД (SQL-скрипт в docs/ops).
-- Триггер trg_log_role_changes (0003) пишет в журнал каждое изменение role.
