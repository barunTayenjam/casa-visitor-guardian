-- AI Analysis Results table for persisting NVIDIA LLM analysis
-- Stores analysis results to avoid re-analyzing the same events

CREATE TABLE IF NOT EXISTS ai_analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_filename VARCHAR(255) NOT NULL,
    camera_id VARCHAR(50),
    
    -- Scene analysis
    scene_description TEXT,
    threat_level VARCHAR(20) DEFAULT 'low',
    threat_confidence INTEGER DEFAULT 0,
    
    -- Detected entities (JSON)
    detected_people JSONB DEFAULT '[]'::jsonb,
    detected_vehicles JSONB DEFAULT '[]'::jsonb,
    detected_objects JSONB DEFAULT '[]'::jsonb,
    detected_animals JSONB DEFAULT '[]'::jsonb,
    
    -- Bounding boxes (JSON)
    bounding_boxes JSONB DEFAULT '[]'::jsonb,
    
    -- Recommendations
    recommended_actions JSONB DEFAULT '[]'::jsonb,
    additional_observations TEXT,
    
    -- Metadata
    model_used VARCHAR(100),
    processing_time_ms INTEGER,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups by event_id
CREATE INDEX IF NOT EXISTS idx_ai_analysis_event_id ON ai_analysis_results(event_id);

-- Index for lookups by camera
CREATE INDEX IF NOT EXISTS idx_ai_analysis_camera_id ON ai_analysis_results(camera_id);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_ai_analysis_analyzed_at ON ai_analysis_results(analyzed_at);

-- Index for camera + date queries
CREATE INDEX IF NOT EXISTS idx_ai_analysis_camera_date ON ai_analysis_results(camera_id, analyzed_at);