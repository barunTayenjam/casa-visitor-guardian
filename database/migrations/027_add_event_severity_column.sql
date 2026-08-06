-- Migration 027: Add severity column to events table
-- Severity tiers: alert (person/face), detection (vehicle/objects), info (motion/general)

ALTER TABLE events ADD COLUMN IF NOT EXISTS severity VARCHAR(20) NOT NULL DEFAULT 'info';

CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);

COMMENT ON COLUMN events.severity IS 'Severity tier: alert (person/face), detection (vehicle/objects), info (motion/general)';
