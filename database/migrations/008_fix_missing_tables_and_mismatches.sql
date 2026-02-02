-- File: database/migrations/008_fix_missing_tables_and_mismatches.sql
-- Purpose: Fix missing tables and visitor_timeline structure mismatch
-- Date: February 2, 2026

-- Create review_segments table (missing from database - defined in 007 but not created)
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

-- Create adaptive_regions table (missing from database - defined in 007 but not created)
CREATE TABLE IF NOT EXISTS adaptive_regions (
    camera VARCHAR(20) PRIMARY KEY,
    grid JSONB DEFAULT '{"cells": [], "last_update": null}'::jsonb,
    last_update TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE adaptive_regions IS 'Spatial grid for detection optimization - tracks active detection regions';
COMMENT ON COLUMN adaptive_regions.camera IS 'Camera name';
COMMENT ON COLUMN adaptive_regions.grid IS 'Region grid data with cell coordinates and last update time';
COMMENT ON COLUMN adaptive_regions.last_update IS 'Last grid update timestamp';

-- Fix visitor_timeline table structure to match TypeORM model
-- Current structure has: date (PK), visitors (jsonb), summary (jsonb), created_at, updated_at
-- Expected structure has individual columns for each visitor attribute
-- Since the table has 0 rows, we can safely drop and recreate it
DROP TABLE IF EXISTS visitor_timeline CASCADE;

CREATE TABLE visitor_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TEXT NOT NULL,
    camera_id TEXT NOT NULL,
    visitor_type TEXT NOT NULL,
    visitor_id TEXT,
    visitor_name TEXT,
    first_seen TIMESTAMP NOT NULL,
    last_seen TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 0,
    confidence FLOAT DEFAULT 0.0,
    visit_count INTEGER DEFAULT 1,
    photo_paths TEXT,
    camera_ids TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visitor_timeline_date ON visitor_timeline (date);
CREATE INDEX IF NOT EXISTS idx_visitor_timeline_camera_id ON visitor_timeline (camera_id);
CREATE INDEX IF NOT EXISTS idx_visitor_timeline_visitor_type ON visitor_timeline (visitor_type);
CREATE INDEX IF NOT EXISTS idx_visitor_timeline_first_seen ON visitor_timeline (first_seen);

COMMENT ON TABLE visitor_timeline IS 'Visitor tracking with individual visit records and statistics';
COMMENT ON COLUMN visitor_timeline.id IS 'Unique visitor record ID';
COMMENT ON COLUMN visitor_timeline.date IS 'Date of visit (YYYY-MM-DD)';
COMMENT ON COLUMN visitor_timeline.camera_id IS 'Camera where visitor was detected';
COMMENT ON COLUMN visitor_timeline.visitor_type IS 'Visitor type: known or unknown';
COMMENT ON COLUMN visitor_timeline.visitor_id IS 'Known visitor ID from face recognition';
COMMENT ON COLUMN visitor_timeline.visitor_name IS 'Name of known visitor';
COMMENT ON COLUMN visitor_timeline.first_seen IS 'First detection timestamp';
COMMENT ON COLUMN visitor_timeline.last_seen IS 'Last detection timestamp';
COMMENT ON COLUMN visitor_timeline.duration_minutes IS 'Visit duration in minutes';
COMMENT ON COLUMN visitor_timeline.confidence IS 'Detection confidence score';
COMMENT ON COLUMN visitor_timeline.visit_count IS 'Number of visits for this visitor';
COMMENT ON COLUMN visitor_timeline.photo_paths IS 'Comma-separated paths to visitor photos';
COMMENT ON COLUMN visitor_timeline.camera_ids IS 'Comma-separated camera IDs where seen';
