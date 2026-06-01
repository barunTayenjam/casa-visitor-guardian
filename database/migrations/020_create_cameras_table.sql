-- Migration 020: Create cameras table for persistent camera definitions
-- Cameras added via the UI are persisted here so they survive container restarts.

CREATE TABLE IF NOT EXISTS cameras (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cameras_enabled ON cameras(enabled);
CREATE INDEX IF NOT EXISTS idx_cameras_created_at ON cameras(created_at DESC);

CREATE OR REPLACE FUNCTION update_cameras_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cameras_updated_at ON cameras;
CREATE TRIGGER trigger_update_cameras_updated_at
    BEFORE UPDATE ON cameras
    FOR EACH ROW
    EXECUTE FUNCTION update_cameras_updated_at();

COMMENT ON TABLE cameras IS 'Camera definitions persisted across restarts';
COMMENT ON COLUMN cameras.config IS 'Full camera configuration as JSONB (streams, detect, objects, zones, etc.)';
