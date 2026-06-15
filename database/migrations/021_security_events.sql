-- Migration 015: Create security_events table for security audit logging
-- This table tracks security-related events like credential decryption failures

CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on event_type for filtering
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);

-- Create index on timestamp for time-based queries
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);

-- Create index on user_id for user-specific queries
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);

-- Add comment
COMMENT ON TABLE security_events IS 'Audit log for security-related events';
COMMENT ON COLUMN security_events.event_type IS 'Type of security event (e.g., CREDENTIAL_DECRYPTION_FAILED, PLAINTEXT_CREDENTIALS_DETECTED)';
COMMENT ON COLUMN security_events.user_id IS 'Optional user ID associated with the event';
COMMENT ON COLUMN security_events.ip_address IS 'IP address from which the event originated';
COMMENT ON COLUMN security_events.details IS 'Additional event details in JSONB format';
