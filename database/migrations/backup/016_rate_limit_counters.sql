-- Migration 016: Create rate_limit_counters table for PostgreSQL-backed rate limiting

CREATE TABLE IF NOT EXISTS rate_limit_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast lookup of user + endpoint within window
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_user_endpoint_window
    ON rate_limit_counters(user_id, endpoint, window_start);

-- Create index for cleanup of old records
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_window_start
    ON rate_limit_counters(window_start);

-- Add constraint to prevent duplicate counters for same user/endpoint/window
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limit_counters_unique
    ON rate_limit_counters(user_id, endpoint, window_start)
    WHERE count > 0;

-- Add function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rate_limit_counters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_rate_limit_counters_updated_at ON rate_limit_counters;
CREATE TRIGGER trigger_update_rate_limit_counters_updated_at
    BEFORE UPDATE ON rate_limit_counters
    FOR EACH ROW
    EXECUTE FUNCTION update_rate_limit_counters_updated_at();

-- Add comments
COMMENT ON TABLE rate_limit_counters IS 'Track API request counts per user for rate limiting';
COMMENT ON COLUMN rate_limit_counters.user_id IS 'User making the request (nullable for unauthenticated)';
COMMENT ON COLUMN rate_limit_counters.endpoint IS 'API endpoint pattern (e.g., /api/detection/*)';
COMMENT ON COLUMN rate_limit_counters.count IS 'Number of requests in current window';
COMMENT ON COLUMN rate_limit_counters.window_start IS 'Start timestamp of the current rate limit window';
