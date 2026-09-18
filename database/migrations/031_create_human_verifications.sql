-- Migration 031: Create human_verifications table
-- Structured metadata from HumanVerifier (MediaPipe pose + face tiered check):
-- which tier confirmed the person, keypoint count, latency, ROI size.
-- Fed by detectionPersistence when a person event is saved; discarded
-- (unverified) tracks are logged to service_logs instead.

CREATE TABLE IF NOT EXISTS human_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    camera_id VARCHAR(64) NOT NULL,
    track_id VARCHAR(64),
    verified BOOLEAN NOT NULL,
    tier VARCHAR(16) NOT NULL,
    keypoints INTEGER NOT NULL DEFAULT 0,
    face_detected BOOLEAN NOT NULL DEFAULT FALSE,
    yolo_score REAL NOT NULL DEFAULT 0,
    roi_width INTEGER NOT NULL DEFAULT 0,
    roi_height INTEGER NOT NULL DEFAULT 0,
    elapsed_ms INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_human_verifications_event ON human_verifications(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_human_verifications_camera ON human_verifications(camera_id);
CREATE INDEX IF NOT EXISTS idx_human_verifications_tier ON human_verifications(tier);
CREATE INDEX IF NOT EXISTS idx_human_verifications_timestamp ON human_verifications(timestamp DESC);
