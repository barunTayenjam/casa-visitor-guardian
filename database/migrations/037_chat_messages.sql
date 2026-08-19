-- Persistent chat history for the Ask feature. One row per message (user or
-- assistant); assistant rows carry the tool + params that produced them so
-- past answers can be re-rendered or audited.

CREATE TABLE IF NOT EXISTS chat_messages (
    id bigserial PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    tool text,
    params jsonb,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
    ON chat_messages (user_id, created_at DESC);
