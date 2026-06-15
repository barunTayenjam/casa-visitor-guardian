-- Migration 010: Create notification preferences table
-- Stores user notification preferences per event type and quiet hours

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    motion_enabled BOOLEAN DEFAULT true,
    face_enabled BOOLEAN DEFAULT true,
    object_enabled BOOLEAN DEFAULT true,
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '06:00',
    quiet_hours_timezone TEXT DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id
    ON notification_preferences(user_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE notification_preferences IS 'Stores user-specific notification preferences';
COMMENT ON COLUMN notification_preferences.motion_enabled IS 'Enable/disable motion detection notifications';
COMMENT ON COLUMN notification_preferences.face_enabled IS 'Enable/disable face recognition notifications';
COMMENT ON COLUMN notification_preferences.object_enabled IS 'Enable/disable object detection notifications';
COMMENT ON COLUMN notification_preferences.quiet_hours_enabled IS 'Enable quiet hours to suppress notifications';
COMMENT ON COLUMN notification_preferences.quiet_hours_start IS 'Start time for quiet hours (HH:MM format)';
COMMENT ON COLUMN notification_preferences.quiet_hours_end IS 'End time for quiet hours (HH:MM format)';
COMMENT ON COLUMN notification_preferences.quiet_hours_timezone IS 'Timezone for quiet hours (IANA format)';
