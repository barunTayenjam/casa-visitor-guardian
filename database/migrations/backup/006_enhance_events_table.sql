-- File: database/migrations/006_enhance_events_table.sql
-- Purpose: Add detection metadata columns to events table for unified storage
-- Date: January 5, 2026

-- Add detection metadata columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS persons_detected INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS faces_detected INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS known_faces_count INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS unknown_faces_count INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS object_detections JSONB DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS face_detections JSONB DEFAULT '[]';
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for performance on JSONB columns
CREATE INDEX IF NOT EXISTS idx_events_object_detections ON events USING GIN (object_detections);
CREATE INDEX IF NOT EXISTS idx_events_face_detections ON events USING GIN (face_detections);
CREATE INDEX IF NOT EXISTS idx_events_detection_counts ON events (persons_detected, faces_detected);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_events_camera_timestamp_type ON events (camera_id, timestamp, event_type);

-- Add comments for documentation
COMMENT ON COLUMN events.confidence IS 'Confidence score of the detection (0-1)';
COMMENT ON COLUMN events.persons_detected IS 'Number of persons detected in the frame';
COMMENT ON COLUMN events.faces_detected IS 'Total number of faces detected';
COMMENT ON COLUMN events.known_faces_count IS 'Number of recognized faces';
COMMENT ON COLUMN events.unknown_faces_count IS 'Number of unknown faces';
COMMENT ON COLUMN events.object_detections IS 'JSONB array of object detection results';
COMMENT ON COLUMN events.face_detections IS 'JSONB array of face detection results';
COMMENT ON COLUMN events.created_at IS 'Record creation timestamp';
