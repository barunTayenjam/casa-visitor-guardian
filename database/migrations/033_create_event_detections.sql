-- Migration 033: Structured detection metadata for reporting
-- 1. event_detections: one row per YOLO/tracker detection per persisted event
--    (class, confidence, bbox, track, identity, human verification) — enables
--    plain-SQL weekly aggregation (counts by class, avg confidence, peak hours).
-- 2. events gains structured analysis columns: scene_context, threat_assessment,
--    detection_summary — the analysis payloads Python already computes but Node
--    previously dropped at persistence.

CREATE TABLE IF NOT EXISTS event_detections (
    id              BIGSERIAL PRIMARY KEY,
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    camera_id       VARCHAR(100),
    timestamp       TIMESTAMPTZ NOT NULL,
    class           VARCHAR(50) NOT NULL,
    class_id        INTEGER,
    confidence      DOUBLE PRECISION,
    bbox_x          INTEGER,
    bbox_y          INTEGER,
    bbox_w          INTEGER,
    bbox_h          INTEGER,
    track_id        INTEGER,
    track_state     VARCHAR(20),
    tracklet_len    INTEGER,
    identity        VARCHAR(255),
    identity_confidence DOUBLE PRECISION,
    human_verified  BOOLEAN,
    verification_tier VARCHAR(20),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_detections_event_id  ON event_detections (event_id);
CREATE INDEX IF NOT EXISTS idx_event_detections_timestamp ON event_detections (timestamp);
CREATE INDEX IF NOT EXISTS idx_event_detections_class     ON event_detections (class);
CREATE INDEX IF NOT EXISTS idx_event_detections_camera    ON event_detections (camera_id);

-- Analysis payloads Python attaches to each track event
ALTER TABLE events ADD COLUMN IF NOT EXISTS scene_context JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS threat_assessment JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS detection_summary JSONB;
