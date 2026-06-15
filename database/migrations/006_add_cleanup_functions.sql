-- Database Cleanup Functions
-- Functions for automated cleanup of old records

-- Function to delete soft-deleted records older than N days
CREATE OR REPLACE FUNCTION cleanup_old_detection_files(days_old INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM detection_files
    WHERE is_deleted = TRUE
      AND updated_at < NOW() - (days_old || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to archive old event records
CREATE OR REPLACE FUNCTION archive_old_events(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    UPDATE event_queue
    SET status = 'archived'
    WHERE status IN ('completed', 'failed')
      AND processed_at < NOW() - (days_old || ' days')::INTERVAL;

    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up archived events
CREATE OR REPLACE FUNCTION cleanup_archived_events(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM event_queue
    WHERE status = 'archived'
      AND processed_at < NOW() - (days_old || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
