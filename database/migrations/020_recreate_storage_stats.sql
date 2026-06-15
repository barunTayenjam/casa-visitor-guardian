-- Migration 014: Recreate storage_stats table with new schema
BEGIN;

-- Drop existing storage_stats table
DROP TABLE IF EXISTS storage_stats CASCADE;

-- Create storage_stats table with new schema
CREATE TABLE storage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera VARCHAR(50),
  category VARCHAR(20) NOT NULL DEFAULT 'global',
  total_bytes BIGINT NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  oldest_file_days INTEGER NOT NULL DEFAULT 0,
  growth_rate_mb_per_day DECIMAL(10,2) NOT NULL DEFAULT 0,
  breakdown JSONB,
  last_calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_category_valid CHECK (category IN ('alerts', 'detections', 'previews', 'snapshots', 'events', 'global'))
);

-- Create indexes for efficient querying
CREATE INDEX idx_storage_stats_camera ON storage_stats(camera);
CREATE INDEX idx_storage_stats_category ON storage_stats(category);
CREATE INDEX idx_storage_stats_last_calculated ON storage_stats(last_calculated_at);
CREATE INDEX idx_storage_stats_created_at ON storage_stats(created_at);

-- Create unique constraint for camera + category combination
CREATE UNIQUE INDEX idx_storage_stats_camera_category ON storage_stats(camera, category) WHERE camera IS NOT NULL;
CREATE UNIQUE INDEX idx_storage_stats_category_global ON storage_stats(category) WHERE camera IS NULL;

-- Add comments for documentation
COMMENT ON TABLE storage_stats IS 'Tracks storage usage statistics for different categories and cameras';
COMMENT ON COLUMN storage_stats.camera IS 'Camera name (null for global statistics)';
COMMENT ON COLUMN storage_stats.category IS 'Category: alerts, detections, previews, snapshots, events, global';
COMMENT ON COLUMN storage_stats.total_bytes IS 'Total bytes used by this category/camera';
COMMENT ON COLUMN storage_stats.file_count IS 'Total number of files';
COMMENT ON COLUMN storage_stats.oldest_file_days IS 'Age of oldest file in days';
COMMENT ON COLUMN storage_stats.growth_rate_mb_per_day IS 'Average growth rate in MB per day (calculated from last 7 days)';
COMMENT ON COLUMN storage_stats.breakdown IS 'Detailed breakdown by file type/format';

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_storage_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_storage_stats_updated_at
  BEFORE UPDATE ON storage_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_storage_stats_updated_at();

COMMIT;
