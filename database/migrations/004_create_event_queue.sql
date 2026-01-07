-- Event Queue Table for Persistent Event Storage
-- This table ensures events persist across server restarts

CREATE TABLE IF NOT EXISTS event_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    camera_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'archived')),
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    error_message TEXT
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_event_queue_status ON event_queue(status);
CREATE INDEX IF NOT EXISTS idx_event_queue_priority ON event_queue(priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_event_queue_camera ON event_queue(camera_id, created_at);
CREATE INDEX IF NOT EXISTS idx_event_queue_created_at ON event_queue(created_at DESC);
