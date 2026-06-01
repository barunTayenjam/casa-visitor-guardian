-- Migration: Unified Storage with File Indexing
-- Description: Create tables to track all detection files with metadata
-- Version: 003

-- Detection files table to track all persisted media
CREATE TABLE IF NOT EXISTS detection_files (
    id SERIAL PRIMARY KEY,
    file_uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('event_face', 'event_motion', 'snapshot', 'batch_result', 'temp')),
    camera_id VARCHAR(100),
    original_filename VARCHAR(500),
    storage_path VARCHAR(1000) NOT NULL,
    file_size BIGINT,
    file_hash VARCHAR(64),
    capture_timestamp TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_archived BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_detection_files_file_type ON detection_files(file_type);
CREATE INDEX IF NOT EXISTS idx_detection_files_camera_id ON detection_files(camera_id);
CREATE INDEX IF NOT EXISTS idx_detection_files_capture_timestamp ON detection_files(capture_timestamp);
CREATE INDEX IF NOT EXISTS idx_detection_files_created_at ON detection_files(created_at);
CREATE INDEX IF NOT EXISTS idx_detection_files_is_archived ON detection_files(is_archived);
CREATE INDEX IF NOT EXISTS idx_detection_files_is_deleted ON detection_files(is_deleted);
CREATE INDEX IF NOT EXISTS idx_detection_files_storage_path ON detection_files(storage_path);
CREATE INDEX IF NOT EXISTS idx_detection_files_metadata ON detection_files USING GIN(metadata);

-- Storage statistics table for monitoring
CREATE TABLE IF NOT EXISTS storage_stats (
    id SERIAL PRIMARY KEY,
    stat_date DATE NOT NULL UNIQUE,
    file_type VARCHAR(50),
    total_files INTEGER DEFAULT 0,
    total_size BIGINT DEFAULT 0,
    new_files INTEGER DEFAULT 0,
    deleted_files INTEGER DEFAULT 0,
    archived_files INTEGER DEFAULT 0,
    calculated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for storage stats
CREATE INDEX IF NOT EXISTS idx_storage_stats_stat_date ON storage_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_storage_stats_file_type ON storage_stats(file_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_detection_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for detection_files
DROP TRIGGER IF EXISTS trigger_update_detection_files_updated_at ON detection_files;
CREATE TRIGGER trigger_update_detection_files_updated_at
    BEFORE UPDATE ON detection_files
    FOR EACH ROW
    EXECUTE FUNCTION update_detection_files_updated_at();

-- Function to insert storage stats
CREATE OR REPLACE FUNCTION calculate_storage_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
    file_rec RECORD;
BEGIN
    -- Calculate stats for each file type
    FOR file_rec IN
        SELECT file_type, COUNT(*) as file_count, SUM(file_size) as total_file_size
        FROM detection_files
        WHERE DATE(created_at) = target_date
          AND is_deleted = FALSE
        GROUP BY file_type
    LOOP
        INSERT INTO storage_stats (stat_date, file_type, total_files, total_size)
        VALUES (target_date, file_rec.file_type, file_rec.file_count, COALESCE(file_rec.total_file_size, 0))
        ON CONFLICT (stat_date, file_type)
        DO UPDATE SET
            total_files = EXCLUDED.total_files,
            total_size = EXCLUDED.total_size,
            calculated_at = NOW();
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to archive old files
CREATE OR REPLACE FUNCTION archive_old_files(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    UPDATE detection_files
    SET is_archived = TRUE,
        updated_at = NOW()
    WHERE created_at < NOW() - (days_old || ' days')::INTERVAL
      AND is_archived = FALSE
      AND is_deleted = FALSE;

    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get files for archiving
CREATE OR REPLACE FUNCTION get_files_for_archive(days_old INTEGER DEFAULT 30)
RETURNS TABLE (
    file_id INTEGER,
    file_uuid UUID,
    file_type VARCHAR(50),
    storage_path VARCHAR(1000),
    capture_timestamp TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        df.id,
        df.file_uuid,
        df.file_type,
        df.storage_path,
        df.capture_timestamp
    FROM detection_files df
    WHERE df.created_at < NOW() - (days_old || ' days')::INTERVAL
      AND df.is_archived = FALSE
      AND df.is_deleted = FALSE
    ORDER BY df.created_at;
END;
$$ LANGUAGE plpgsql;

-- Function to soft delete files
CREATE OR REPLACE FUNCTION soft_delete_file(file_uuid_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE detection_files
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE file_uuid = file_uuid_param;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to permanently delete old files (hard delete)
CREATE OR REPLACE FUNCTION delete_old_files(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM detection_files
    WHERE created_at < NOW() - (days_old || ' days')::INTERVAL
      AND is_deleted = TRUE;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust based on your database user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON detection_files TO sentryvision;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON batch_jobs TO sentryvision;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON storage_stats TO sentryvision;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO sentryvision;

-- Add comments for documentation
COMMENT ON TABLE detection_files IS 'Tracks all detection files stored in the unified storage system';
COMMENT ON COLUMN detection_files.file_uuid IS 'Unique identifier for the file';
COMMENT ON COLUMN detection_files.file_type IS 'Type of detection file: event_face, event_motion, snapshot, batch_result, temp';
COMMENT ON COLUMN detection_files.storage_path IS 'Full file system path where the file is stored';
COMMENT ON COLUMN detection_files.file_hash IS 'SHA-256 hash for file integrity verification';
COMMENT ON COLUMN detection_files.metadata IS 'JSONB metadata for detection results, confidence scores, objects detected, etc.';

COMMENT ON TABLE storage_stats IS 'Daily storage statistics for monitoring and cleanup';
