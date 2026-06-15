-- Face recognition configuration table
CREATE TABLE IF NOT EXISTS face_recognition_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    category TEXT, -- 'threshold', 'algorithm', 'feature'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Default configuration values
INSERT INTO face_recognition_config (config_key, config_value, description, category) VALUES
(
    'similarity_threshold',
    '{"value": 0.6, "min": 0.3, "max": 0.8, "step": 0.05}',
    'Cosine similarity threshold for face matching (0-1, higher = stricter)',
    'threshold'
),
(
    'comparison_algorithm',
    '{"algorithm": "cosine", "fallback": "euclidean"}',
    'Primary comparison algorithm for face matching',
    'algorithm'
),
(
    'min_face_quality',
    '{"value": 60, "min": 0, "max": 100}',
    'Minimum face quality score for recognition attempt',
    'threshold'
),
(
    'max_embeddings_per_visitor',
    '{"value": 10, "min": 1, "max": 50}',
    'Maximum number of embeddings to store per visitor',
    'feature'
)
ON CONFLICT (config_key) DO NOTHING;

-- Index for fast config lookup
CREATE INDEX idx_face_recognition_config_key ON face_recognition_config(config_key);
CREATE INDEX idx_face_recognition_config_category ON face_recognition_config(category);
CREATE INDEX idx_face_recognition_config_active ON face_recognition_config(is_active);

-- Comments
COMMENT ON TABLE face_recognition_config IS 'Face recognition system configuration';
COMMENT ON COLUMN face_recognition_config.config_key IS 'Unique configuration key identifier';
COMMENT ON COLUMN face_recognition_config.config_value IS 'JSONB configuration value';
COMMENT ON COLUMN face_recognition_config.category IS 'Configuration category (threshold, algorithm, feature)';
