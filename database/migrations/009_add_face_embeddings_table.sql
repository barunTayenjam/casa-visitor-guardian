-- Face embeddings table with quality metadata
CREATE TABLE IF NOT EXISTS face_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id UUID NOT NULL REFERENCES visitor_timeline(id) ON DELETE CASCADE,
    embedding_vector REAL[] NOT NULL, -- 128-dimensional vector
    quality_score FLOAT NOT NULL, -- 0-100 overall quality

    -- Quality metadata
    sharpness FLOAT, -- Edge detection score (0-100)
    brightness FLOAT, -- Average brightness (0-255)
    face_width INTEGER, -- Face bounding box width in pixels
    face_height INTEGER, -- Face bounding box height in pixels
    face_area INTEGER, -- Face area in pixels
    face_confidence FLOAT, -- Face detection confidence (0-100)

    -- Capture metadata
    camera_id TEXT NOT NULL,
    image_path TEXT NOT NULL,
    detection_method TEXT NOT NULL, -- 'dnn', 'haar', 'face_recognition'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true, -- Soft delete flag

    -- Indexes for fast lookup
    CONSTRAINT valid_embedding CHECK (array_length(embedding_vector, 1) = 128)
);

-- Index for visitor lookup
CREATE INDEX idx_face_embeddings_visitor_id ON face_embeddings(visitor_id);

-- Index for active embeddings
CREATE INDEX idx_face_embeddings_active ON face_embeddings(is_active) WHERE is_active = true;

-- Index for quality filtering
CREATE INDEX idx_face_embeddings_quality ON face_embeddings(quality_score);

-- Index for camera filtering
CREATE INDEX idx_face_embeddings_camera ON face_embeddings(camera_id);

-- Composite index for common queries
CREATE INDEX idx_face_embeddings_visitor_quality ON face_embeddings(visitor_id, quality_score DESC);

-- Comments for documentation
COMMENT ON TABLE face_embeddings IS 'Stores face embeddings with quality metadata for recognition';
COMMENT ON COLUMN face_embeddings.embedding_vector IS '128-dimensional face embedding vector';
COMMENT ON COLUMN face_embeddings.quality_score IS 'Overall quality score (0-100), combines sharpness, brightness, and size';
COMMENT ON COLUMN face_embeddings.sharpness IS 'Edge detection-based sharpness score (0-100)';
COMMENT ON COLUMN face_embeddings.brightness IS 'Average pixel brightness (0-255)';
COMMENT ON COLUMN face_embeddings.face_width IS 'Face bounding box width in original image';
COMMENT ON COLUMN face_embeddings.face_height IS 'Face bounding box height in original image';
COMMENT ON COLUMN face_embeddings.face_area IS 'Face area in square pixels';
COMMENT ON COLUMN face_embeddings.face_confidence IS 'Face detection confidence score (0-100)';
COMMENT ON COLUMN face_embeddings.is_active IS 'Soft delete flag, false embeddings excluded from recognition';
