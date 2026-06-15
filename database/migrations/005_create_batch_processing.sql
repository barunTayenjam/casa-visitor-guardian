-- Migration: Create batch processing tables (PostgreSQL version)
-- Tables for tracking batch detection jobs and processed images

-- Batch jobs table
CREATE TABLE IF NOT EXISTS batch_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  total_images INTEGER NOT NULL DEFAULT 0,
  processed_images INTEGER NOT NULL DEFAULT 0,
  successful_images INTEGER NOT NULL DEFAULT 0,
  failed_images INTEGER NOT NULL DEFAULT 0,
  person_detections INTEGER NOT NULL DEFAULT 0,
  face_detections INTEGER NOT NULL DEFAULT 0,
  known_faces INTEGER NOT NULL DEFAULT 0,
  unknown_faces INTEGER NOT NULL DEFAULT 0,
  processing_time_ms INTEGER,
  options_json JSONB NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Processed images table
CREATE TABLE IF NOT EXISTS processed_images (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  camera_id TEXT NOT NULL,
  image_timestamp TIMESTAMP NOT NULL,
  file_size BIGINT NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  person_count INTEGER NOT NULL DEFAULT 0,
  face_count INTEGER NOT NULL DEFAULT 0,
  known_face_count INTEGER NOT NULL DEFAULT 0,
  unknown_face_count INTEGER NOT NULL DEFAULT 0,
  processing_time_ms INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  detection_json JSONB NOT NULL DEFAULT '{}',
  file_hash TEXT NOT NULL,
  CONSTRAINT fk_processed_images_job_id
    FOREIGN KEY (job_id)
    REFERENCES batch_jobs(id)
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_created_at ON batch_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_processed_images_job_id ON processed_images(job_id);
CREATE INDEX IF NOT EXISTS idx_processed_images_filename ON processed_images(filename);
CREATE INDEX IF NOT EXISTS idx_processed_images_camera_id ON processed_images(camera_id);
CREATE INDEX IF NOT EXISTS idx_processed_images_processed_at ON processed_images(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_processed_images_file_hash ON processed_images(file_hash);

-- Create unique index on file_hash for duplicate detection
CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_images_file_hash_unique
  ON processed_images(file_hash);

-- Add comments
COMMENT ON TABLE batch_jobs IS 'Tracks batch processing jobs for event detection';
COMMENT ON TABLE processed_images IS 'Stores detection results for each processed image';
COMMENT ON COLUMN batch_jobs.options_json IS 'JSON configuration for batch job';
COMMENT ON COLUMN processed_images.detection_json IS 'Detailed detection results (persons, faces, bounding boxes)';
COMMENT ON COLUMN processed_images.file_hash IS 'File hash for duplicate detection';
