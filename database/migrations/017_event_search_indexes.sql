-- Migration 011: Create indexes for event search API
-- Creates composite indexes for optimized event querying

-- Composite index for date range + camera queries
CREATE INDEX IF NOT EXISTS idx_events_timestamp_camera
  ON events(timestamp DESC, camera_id);

-- Composite index for event type + date queries
CREATE INDEX IF NOT EXISTS idx_events_type_timestamp
  ON events(event_type, timestamp DESC);

-- Composite index for confidence + date queries
CREATE INDEX IF NOT EXISTS idx_events_confidence_timestamp
  ON events(confidence DESC NULLS LAST, timestamp DESC);

-- Composite index for face status queries (known/unknown faces)
CREATE INDEX IF NOT EXISTS idx_events_face_status
  ON events(faces_detected, known_faces_count, timestamp DESC);

-- Individual indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_events_camera_id
  ON events(camera_id);

CREATE INDEX IF NOT EXISTS idx_events_event_type
  ON events(event_type);

CREATE INDEX IF NOT EXISTS idx_events_confidence
  ON events(confidence);

-- Partial index for recent events (last 7 days) - useful for common queries
CREATE INDEX IF NOT EXISTS idx_events_recent
  ON events(timestamp DESC)
  WHERE timestamp >= NOW() - INTERVAL '7 days';

-- Add comments
COMMENT ON INDEX idx_events_timestamp_camera IS 'Optimizes date range + camera filter queries';
COMMENT ON INDEX idx_events_type_timestamp IS 'Optimizes event type + date range queries';
COMMENT ON INDEX idx_events_confidence_timestamp IS 'Optimizes confidence level + date queries';
COMMENT ON INDEX idx_events_face_status IS 'Optimizes face recognition status queries';
COMMENT ON INDEX idx_events_recent IS 'Optimizes queries for recent events (last 7 days)';
