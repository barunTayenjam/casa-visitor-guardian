-- File: database/migrations/007_create_review_timeline_tables.sql
-- Purpose: Create review, timeline, and detection configuration tables
-- Date: January 18, 2026

-- Create review_segments table
CREATE TABLE IF NOT EXISTS review_segments (
    id VARCHAR(30) PRIMARY KEY,
    camera VARCHAR(20) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    severity VARCHAR(30) NOT NULL,
    labels JSONB DEFAULT '[]'::jsonb,
    thumbnail_path VARCHAR(255),
    preview_path VARCHAR(255),
    data JSONB DEFAULT '{}'::jsonb,
    retain_indefinitely BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_review_segments_camera_start ON review_segments (camera, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_review_segments_severity ON review_segments (severity);
CREATE INDEX IF NOT EXISTS idx_review_segments_labels ON review_segments USING GIN (labels);

COMMENT ON TABLE review_segments IS 'Bundled review periods with severity classification, labels, thumbnails, and preview paths';
COMMENT ON COLUMN review_segments.id IS 'Unique segment ID';
COMMENT ON COLUMN review_segments.camera IS 'Camera name';
COMMENT ON COLUMN review_segments.start_time IS 'Segment start time';
COMMENT ON COLUMN review_segments.end_time IS 'Segment end time';
COMMENT ON COLUMN review_segments.severity IS 'Severity: alert or detection';
COMMENT ON COLUMN review_segments.labels IS 'Array of labels in segment';
COMMENT ON COLUMN review_segments.thumbnail_path IS 'Path to thumbnail image';
COMMENT ON COLUMN review_segments.preview_path IS 'Path to preview video';
COMMENT ON COLUMN review_segments.data IS 'Additional metadata including objects, regions, motion boxes';
COMMENT ON COLUMN review_segments.retain_indefinitely IS 'Flag to retain segment indefinitely';

-- Create user_review_status table (composite primary key)
CREATE TABLE IF NOT EXISTS user_review_status (
    user_id VARCHAR(30) NOT NULL,
    review_segment_id VARCHAR(30) NOT NULL,
    has_been_reviewed BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, review_segment_id)
);

COMMENT ON TABLE user_review_status IS 'Tracks which users reviewed which segments';
COMMENT ON COLUMN user_review_status.user_id IS 'User ID';
COMMENT ON COLUMN user_review_status.review_segment_id IS 'Review segment ID';
COMMENT ON COLUMN user_review_status.has_been_reviewed IS 'Has been reviewed flag';
COMMENT ON COLUMN user_review_status.reviewed_at IS 'Review timestamp';

-- Create timeline table
CREATE TABLE IF NOT EXISTS timeline (
    id VARCHAR(30) PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    camera VARCHAR(20) NOT NULL,
    source VARCHAR(20) NOT NULL,
    source_id VARCHAR(30) NOT NULL,
    class_type VARCHAR(50) NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_timeline_camera_timestamp ON timeline (camera, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_source_id ON timeline (source, source_id);
CREATE INDEX IF NOT EXISTS idx_timeline_class_type ON timeline (class_type);
CREATE INDEX IF NOT EXISTS idx_timeline_source_timestamp ON timeline (source, timestamp DESC);

COMMENT ON TABLE timeline IS 'Unified timeline events from multiple sources (tracked_object, audio, api, system)';
COMMENT ON COLUMN timeline.id IS 'Timeline event ID';
COMMENT ON COLUMN timeline.timestamp IS 'Event timestamp';
COMMENT ON COLUMN timeline.camera IS 'Camera name';
COMMENT ON COLUMN timeline.source IS 'Event source: tracked_object, audio, api, system';
COMMENT ON COLUMN timeline.source_id IS 'Source-specific ID';
COMMENT ON COLUMN timeline.class_type IS 'Event classification';
COMMENT ON COLUMN timeline.data IS 'Source-specific metadata including object_id, label, score, box';

-- Create adaptive_regions table
CREATE TABLE IF NOT EXISTS adaptive_regions (
    camera VARCHAR(20) PRIMARY KEY,
    grid JSONB DEFAULT '{"cells": [], "last_update": null}'::jsonb,
    last_update TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE adaptive_regions IS 'Spatial grid for detection optimization - tracks active detection regions';
COMMENT ON COLUMN adaptive_regions.camera IS 'Camera name';
COMMENT ON COLUMN adaptive_regions.grid IS 'Region grid data with cell coordinates and last update time';

-- Create detection_config table (already exists with config JSONB column)
-- Add comments for existing detection_config table
COMMENT ON TABLE detection_config IS 'Per-camera detection thresholds and label mappings';
COMMENT ON COLUMN detection_config.camera IS 'Camera name (null for global config)';
COMMENT ON COLUMN detection_config.config IS 'Detection configuration including thresholds and labelmap';
COMMENT ON COLUMN detection_config.config.thresholds IS 'Minimum score and threshold per label type';
COMMENT ON COLUMN detection_config.config.labelmap IS 'Label mapping for consolidating similar types';
COMMENT ON COLUMN detection_config.config.score_history_length IS 'Number of scores to maintain for median filtering';

-- Create retention_policies table
CREATE TABLE IF NOT EXISTS retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camera VARCHAR(20) UNIQUE,
    alerts_days INTEGER DEFAULT 30,
    detections_days INTEGER DEFAULT 7,
    previews_days INTEGER DEFAULT 7,
    snapshots_days INTEGER DEFAULT 30,
    events_days INTEGER DEFAULT 30,
    retain_indefinitely BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE retention_policies IS 'Retention settings per camera for different data types';
COMMENT ON COLUMN retention_policies.camera IS 'Camera name (null for global policy)';
COMMENT ON COLUMN retention_policies.alerts_days IS 'Days to retain alert-level events';
COMMENT ON COLUMN retention_policies.detections_days IS 'Days to retain detection-level events';
COMMENT ON COLUMN retention_policies.previews_days IS 'Days to retain preview videos';
COMMENT ON COLUMN retention_policies.snapshots_days IS 'Days to retain snapshots';
COMMENT ON COLUMN retention_policies.events_days IS 'Days to retain general events';
COMMENT ON COLUMN retention_policies.retain_indefinitely IS 'Global flag to retain everything indefinitely';
