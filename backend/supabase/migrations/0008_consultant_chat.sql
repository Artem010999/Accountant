CREATE TABLE IF NOT EXISTS project_chat_messages (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id        uuid NOT NULL REFERENCES app_projects(id) ON DELETE CASCADE,
    user_id           uuid NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
    role              text NOT NULL CHECK (role IN ('user', 'assistant')),
    content           text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 20000),
    referenced_cards  text[] NOT NULL DEFAULT '{}'::text[],
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_chat_messages_project_created
    ON project_chat_messages (project_id, created_at DESC);

ALTER TABLE project_chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY project_chat_messages_owner ON project_chat_messages
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
