-- Unknown face detections table
CREATE TABLE IF NOT EXISTS unknown_face_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    face_id TEXT NOT NULL, -- Face detection ID in event

    -- Face metadata
    bbox JSONB NOT NULL, -- {x, y, width, height}
    confidence FLOAT NOT NULL, -- Face detection confidence
    embedding_vector REAL[], -- Face embedding vector (128-dim)

    -- Recognition results
    similarity_score FLOAT, -- Best similarity score found
    similarity_threshold FLOAT, -- Threshold used for comparison
    matched_visitor_id UUID, -- Best matched visitor (if any)
    matched_visitor_name TEXT, -- Best matched visitor name (if any)

    -- Context
    camera_id TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    image_path TEXT NOT NULL,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'unknown', -- 'unknown', 'pending_review', 'identified', 'dismissed'
    marked_as_visitor_id UUID, -- User marked as this visitor
    marked_as_visitor_name TEXT, -- User marked with this name
    marked_at TIMESTAMP WITH TIME ZONE,
    marked_by TEXT, -- User ID who marked it

    -- Review metadata
    notes TEXT,
    tags TEXT[], -- e.g., ['regular', 'suspicious', 'delivery']

    -- Statistics
    detection_count INTEGER DEFAULT 1, -- How many times this unknown face seen
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX idx_unknown_face_detections_event ON unknown_face_detections(event_id);
CREATE INDEX idx_unknown_face_detections_status ON unknown_face_detections(status);
CREATE INDEX idx_unknown_face_detections_camera ON unknown_face_detections(camera_id);
CREATE INDEX idx_unknown_face_detections_timestamp ON unknown_face_detections(timestamp DESC);
CREATE INDEX idx_unknown_face_detections_marked_visitor ON unknown_face_detections(marked_as_visitor_id);
CREATE INDEX idx_unknown_face_detections_similarity ON unknown_face_detections(similarity_score);

-- Unknown face alerts table
CREATE TABLE IF NOT EXISTS unknown_face_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detection_id UUID NOT NULL REFERENCES unknown_face_detections(id) ON DELETE CASCADE,

    -- Alert metadata
    alert_type TEXT NOT NULL DEFAULT 'unknown_face', -- 'unknown_face', 'frequent_unknown', 'night_time'
    severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    message TEXT NOT NULL,

    -- Alert status
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'acknowledged', 'dismissed'
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by TEXT,

    -- Notification tracking
    notification_sent BOOLEAN DEFAULT false,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    notification_method TEXT[], -- ['push', 'email', 'sms']

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for alerts
CREATE INDEX idx_unknown_face_alerts_detection ON unknown_face_alerts(detection_id);
CREATE INDEX idx_unknown_face_alerts_status ON unknown_face_alerts(status);
CREATE INDEX idx_unknown_face_alerts_severity ON unknown_face_alerts(severity);
CREATE INDEX idx_unknown_face_alerts_created ON unknown_face_alerts(created_at DESC);

-- Unknown face frequency tracking (for pattern analysis)
CREATE TABLE IF NOT EXISTS unknown_face_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Pattern identification
    pattern_hash TEXT NOT NULL UNIQUE, -- Hash of embedding vector (approximate matching)
    pattern_type TEXT NOT NULL, -- 'regular_visitor', 'delivery', 'service', 'suspicious'

    -- Statistics
    detection_count INTEGER DEFAULT 1,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Context
    cameras_seen TEXT[],
    time_patterns JSONB, -- {hours: [9,10,17,18], days: [1,2,3,4,5]}

    -- Status
    status TEXT NOT NULL DEFAULT 'unknown', -- 'unknown', 'identified', 'ignore'

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_unknown_face_patterns_hash ON unknown_face_patterns(pattern_hash);
CREATE INDEX idx_unknown_face_patterns_status ON unknown_face_patterns(status);

-- Comments
COMMENT ON TABLE unknown_face_detections IS 'Tracks all unknown face detections with metadata';
COMMENT ON TABLE unknown_face_alerts IS 'Alerts generated for unknown face detections';
COMMENT ON TABLE unknown_face_patterns IS 'Pattern analysis for recurring unknown faces';
COMMENT ON COLUMN unknown_face_detections.status IS 'Detection status: unknown, pending_review, identified, dismissed';
COMMENT ON COLUMN unknown_face_detections.similarity_score IS 'Best cosine similarity score with known visitors';
COMMENT ON COLUMN unknown_face_alerts.severity IS 'Alert severity: low, medium, high, critical';
