-- Store the full chat response payload on assistant messages so history
-- restore renders tables, images, and evidence exactly as the live answer.
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS response jsonb;
