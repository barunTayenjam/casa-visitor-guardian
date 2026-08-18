-- Migration 029: Create service_logs table for persistent operational logging
-- Survives container rebuilds — fed by the backend logger and the OpenCV
-- service over WebSocket. Retention handled by daily purge cron.

CREATE TABLE IF NOT EXISTS service_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    service VARCHAR(32) NOT NULL,
    level VARCHAR(16) NOT NULL,
    module VARCHAR(64),
    camera_id VARCHAR(64),
    message TEXT NOT NULL,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_service_logs_timestamp ON service_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_service_logs_service ON service_logs(service);
CREATE INDEX IF NOT EXISTS idx_service_logs_level ON service_logs(level);
CREATE INDEX IF NOT EXISTS idx_service_logs_camera ON service_logs(camera_id) WHERE camera_id IS NOT NULL;
