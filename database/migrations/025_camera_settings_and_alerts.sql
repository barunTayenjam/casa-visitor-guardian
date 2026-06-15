-- Migration 019: Create camera_settings table for persistent per-camera settings
-- and alerts table for persistent alert history.

-- Camera settings: single JSONB row per camera for all settings types
CREATE TABLE IF NOT EXISTS camera_settings (
    camera_id UUID PRIMARY KEY,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_camera_settings_updated_at
    ON camera_settings(updated_at DESC);

-- Add function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_camera_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_camera_settings_updated_at ON camera_settings;
CREATE TRIGGER trigger_update_camera_settings_updated_at
    BEFORE UPDATE ON camera_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_camera_settings_updated_at();

COMMENT ON TABLE camera_settings IS 'Per-camera settings stored as JSONB for flexibility';
COMMENT ON COLUMN camera_settings.camera_id IS 'Camera UUID (matches cameras config id)';
COMMENT ON COLUMN camera_settings.settings IS 'JSONB blob containing motion, objectDetection, and facialRecognition settings';

-- Alerts table: persistent alert history
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
    message TEXT NOT NULL,
    camera_id VARCHAR(100),
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_alerts_created_at
    ON alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_camera_created
    ON alerts(camera_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged
    ON alerts(acknowledged, created_at DESC);

-- Add trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_alerts_updated_at ON alerts;
CREATE TRIGGER trigger_update_alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_camera_settings_updated_at();

COMMENT ON TABLE alerts IS 'Persistent alert history for system events';
COMMENT ON COLUMN alerts.type IS 'Alert category: motion, camera, system';
COMMENT ON COLUMN alerts.severity IS 'Severity level: info, warning, error';
COMMENT ON COLUMN alerts.camera_id IS 'Optional camera identifier';
COMMENT ON COLUMN alerts.acknowledged IS 'Whether the alert has been acknowledged by a user';
