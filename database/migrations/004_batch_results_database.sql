-- Migration: Store Batch Results in Database Instead of JSON Files
-- Description: Create tables to store batch processing results directly in PostgreSQL
-- Version: 004

-- Create new batch_jobs table (will replace old one from 003)
DROP TABLE IF EXISTS batch_jobs CASCADE;
DROP VIEW IF EXISTS batch_job_summaries;

-- Batch jobs table
CREATE TABLE batch_jobs (
    id SERIAL PRIMARY KEY,
    job_uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('classification', 'detection', 'recognition')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    time_range_start TIMESTAMP,
    time_range_end TIMESTAMP,
    detection_types TEXT[], -- Array of detection types ['person', 'face', 'both']
    confidence_threshold DECIMAL(5,4) DEFAULT 0.7,
    total_images INTEGER DEFAULT 0,
    person_detections INTEGER DEFAULT 0,
    face_detections INTEGER DEFAULT 0,
    known_faces INTEGER DEFAULT 0,
    unknown_faces INTEGER DEFAULT 0,
    processed_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Batch result items table (individual detection results)
CREATE TABLE batch_result_items (
    id SERIAL PRIMARY KEY,
    batch_job_id INTEGER NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    camera_id VARCHAR(100),
    detection_file_uuid UUID REFERENCES detection_files(file_uuid) ON DELETE SET NULL,
    persons_detected INTEGER DEFAULT 0,
    faces_detected INTEGER DEFAULT 0,
    known_faces_count INTEGER DEFAULT 0,
    unknown_faces_count INTEGER DEFAULT 0,
    detection_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for batch_jobs
CREATE INDEX idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX idx_batch_jobs_created_at ON batch_jobs(created_at);
CREATE INDEX idx_batch_jobs_job_type ON batch_jobs(job_type);
CREATE INDEX idx_batch_jobs_time_range ON batch_jobs(time_range_start, time_range_end);

-- Create indexes for batch_result_items
CREATE INDEX idx_batch_result_items_batch_job_id ON batch_result_items(batch_job_id);
CREATE INDEX idx_batch_result_items_camera_id ON batch_result_items(camera_id);
CREATE INDEX idx_batch_result_items_timestamp ON batch_result_items(timestamp);
CREATE INDEX idx_batch_result_items_detection_file ON batch_result_items(detection_file_uuid);

-- Function to create a new batch job
CREATE OR REPLACE FUNCTION create_batch_job(
    p_job_type VARCHAR,
    p_detection_types TEXT[],
    p_confidence_threshold DECIMAL,
    p_time_range_start TIMESTAMP,
    p_time_range_end TIMESTAMP,
    p_metadata JSONB DEFAULT '{}'
) RETURNS INTEGER AS $$
DECLARE
    v_job_id INTEGER;
BEGIN
    INSERT INTO batch_jobs (
        job_uuid,
        job_type,
        detection_types,
        confidence_threshold,
        time_range_start,
        time_range_end,
        status,
        metadata
    ) VALUES (
        gen_random_uuid(),
        p_job_type,
        p_detection_types,
        p_confidence_threshold,
        p_time_range_start,
        p_time_range_end,
        'pending',
        p_metadata
    ) RETURNING id INTO v_job_id;

    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update batch job progress
CREATE OR REPLACE FUNCTION update_batch_job_progress(
    p_job_id INTEGER,
    p_processed_files INTEGER,
    p_person_detections INTEGER,
    p_face_detections INTEGER,
    p_known_faces INTEGER,
    p_unknown_faces INTEGER,
    p_failed_files INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
    UPDATE batch_jobs
    SET
        total_images = total_images + p_processed_files,
        person_detections = person_detections + p_person_detections,
        face_detections = face_detections + p_face_detections,
        known_faces = known_faces + p_known_faces,
        unknown_faces = unknown_faces + p_unknown_faces,
        failed_files = failed_files + p_failed_files,
        processed_files = processed_files + p_processed_files
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to complete batch job
CREATE OR REPLACE FUNCTION complete_batch_job(
    p_job_id INTEGER,
    p_total_images INTEGER,
    p_person_detections INTEGER,
    p_face_detections INTEGER,
    p_known_faces INTEGER,
    p_unknown_faces INTEGER,
    p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE batch_jobs
    SET
        status = 'completed',
        completed_at = NOW(),
        total_images = p_total_images,
        person_detections = p_person_detections,
        face_detections = p_face_detections,
        known_faces = p_known_faces,
        unknown_faces = p_unknown_faces,
        error_message = p_error_message
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to fail batch job
CREATE OR REPLACE FUNCTION fail_batch_job(
    p_job_id INTEGER,
    p_error_message TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE batch_jobs
    SET
        status = 'failed',
        completed_at = NOW(),
        error_message = p_error_message
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to insert batch result item
CREATE OR REPLACE FUNCTION insert_batch_result_item(
    p_batch_job_id INTEGER,
    p_filename VARCHAR,
    p_timestamp TIMESTAMP,
    p_camera_id VARCHAR,
    p_detection_file_uuid UUID,
    p_detection_data JSONB
) RETURNS INTEGER AS $$
DECLARE
    v_item_id INTEGER;
BEGIN
    INSERT INTO batch_result_items (
        batch_job_id,
        filename,
        timestamp,
        camera_id,
        detection_file_uuid,
        detection_data
    ) VALUES (
        p_batch_job_id,
        p_filename,
        p_timestamp,
        p_camera_id,
        p_detection_file_uuid,
        p_detection_data
    ) RETURNING id INTO v_item_id;

    RETURN v_item_id;
END;
$$ LANGUAGE plpgsql;

-- View for batch job summaries
CREATE OR REPLACE VIEW batch_job_summaries AS
SELECT
    bj.id,
    bj.job_uuid,
    bj.job_type,
    bj.status,
    bj.time_range_start,
    bj.time_range_end,
    bj.detection_types,
    bj.confidence_threshold,
    bj.total_images,
    bj.person_detections,
    bj.face_detections,
    bj.known_faces,
    bj.unknown_faces,
    bj.processed_files,
    bj.failed_files,
    bj.started_at,
    bj.completed_at,
    bj.created_at,
    bj.error_message,
    COUNT(bri.id) as result_items_count,
    EXTRACT(EPOCH FROM (COALESCE(bj.completed_at, NOW()) - COALESCE(bj.started_at, bj.created_at))) as duration_seconds
FROM batch_jobs bj
LEFT JOIN batch_result_items bri ON bj.id = bri.batch_job_id
GROUP BY bj.id, bj.job_uuid, bj.job_type, bj.status, bj.time_range_start, bj.time_range_end,
         bj.detection_types, bj.confidence_threshold, bj.total_images, bj.person_detections,
         bj.face_detections, bj.known_faces, bj.unknown_faces, bj.processed_files,
         bj.failed_files, bj.started_at, bj.completed_at, bj.created_at, bj.error_message;

-- Add comments
COMMENT ON TABLE batch_jobs IS 'Stores batch processing job metadata and statistics';
COMMENT ON TABLE batch_result_items IS 'Stores individual detection results from batch jobs';
COMMENT ON VIEW batch_job_summaries IS 'Provides summaries of batch jobs with result counts and duration';
COMMENT ON COLUMN batch_jobs.job_type IS 'Type of batch job: classification, detection, recognition';
COMMENT ON COLUMN batch_jobs.detection_types IS 'Array of detection types: person, face, both';
COMMENT ON COLUMN batch_jobs.confidence_threshold IS 'Minimum confidence threshold for detections';
COMMENT ON COLUMN batch_result_items.detection_data IS 'JSONB data containing person/face detection arrays';
