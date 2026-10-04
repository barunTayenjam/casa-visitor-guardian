-- Query support indexes for SentryVision
-- 1. Composite index for user_sessions filtering by user_id + is_active
-- 2. Index for detection_files joins on original_filename

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_detection_files_original_filename ON detection_files(original_filename);