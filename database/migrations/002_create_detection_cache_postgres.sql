-- Migration: Create detection_cache table for OpenCV microservice (PostgreSQL version)
-- This replaces the SQLite version with proper PostgreSQL types

CREATE TABLE IF NOT EXISTS detection_cache (
  id SERIAL PRIMARY KEY,
  file_hash TEXT UNIQUE NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_modified TIMESTAMP NOT NULL,
  object_detections JSONB,
  face_detections JSONB,
  processing_time INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_detection_cache_file_hash ON detection_cache(file_hash);
CREATE INDEX IF NOT EXISTS idx_detection_cache_file_path ON detection_cache(file_path);
CREATE INDEX IF NOT EXISTS idx_detection_cache_created_at ON detection_cache(created_at);

-- Add comment to table
COMMENT ON TABLE detection_cache IS 'Cache for OpenCV detection results to prevent reprocessing';
COMMENT ON COLUMN detection_cache.file_hash IS 'SHA-256 hash of image file for deduplication';
COMMENT ON COLUMN detection_cache.object_detections IS 'JSON array of object detection results';
COMMENT ON COLUMN detection_cache.face_detections IS 'JSON array of face recognition results';
COMMENT ON COLUMN detection_cache.processing_time IS 'Processing time in milliseconds';
