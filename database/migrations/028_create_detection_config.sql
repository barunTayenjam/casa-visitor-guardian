-- Migration: 028_create_detection_config.sql
-- Creates the detection_config table used by DetectionConfig entity (server/src/models/DetectionConfig.ts)

CREATE TABLE IF NOT EXISTS detection_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camera VARCHAR(20) UNIQUE,
    config JSONB NOT NULL DEFAULT '{"thresholds":{"person":{"min_score":0.3,"threshold":0.5},"car":{"min_score":0.4,"threshold":0.6},"dog":{"min_score":0.3,"threshold":0.4},"package":{"min_score":0.25,"threshold":0.35}},"labelmap":{"truck":"car","bus":"car","motorcycle":"car"},"score_history_length":7}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE detection_config IS 'Per-camera detection thresholds and label mappings';
COMMENT ON COLUMN detection_config.camera IS 'Camera name (null for global config)';
COMMENT ON COLUMN detection_config.config IS 'Detection configuration including thresholds and labelmap';
