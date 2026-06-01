-- Migration: Create detection_cache table for OpenCV microservice
-- This ensures no regression by keeping existing data intact

CREATE TABLE IF NOT EXISTS detection_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_hash TEXT UNIQUE NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_modified DATETIME NOT NULL,
  object_detections TEXT, -- JSON stored as TEXT in SQLite
  face_detections TEXT,     -- JSON stored as TEXT in SQLite
  processing_time INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_detection_cache_file_hash ON detection_cache(file_hash);
CREATE INDEX IF NOT EXISTS idx_detection_cache_file_path ON detection_cache(file_path);
CREATE INDEX IF NOT EXISTS idx_detection_cache_created_at ON detection_cache(created_at);

-- Add comments for documentation (SQLite doesn't support COMMENT ON TABLE/COLUMN)
-- Table: detection_cache - Cache for OpenCV detection results to prevent reprocessing
-- file_hash: SHA-256 hash of image file for deduplication
-- object_detections: JSON array of object detection results
-- face_detections: JSON array of face recognition results
-- processing_time: Processing time in milliseconds