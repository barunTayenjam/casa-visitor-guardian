-- Add review_action column to user_review_status table
-- Allows distinguishing between 'dismiss' and 'confirm' actions

ALTER TABLE user_review_status
ADD COLUMN IF NOT EXISTS review_action VARCHAR(10) DEFAULT NULL;

COMMENT ON COLUMN user_review_status.review_action IS 'Review action: dismiss (false positive) or confirm (valid detection)';
