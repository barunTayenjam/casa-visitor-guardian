-- Visitors table for management
CREATE TABLE IF NOT EXISTS visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'known', -- 'known' or 'unknown'

    -- Photo storage
    photo_path TEXT, -- Primary photo
    thumbnail_path TEXT, -- Thumbnail for UI

    -- Recognition data
    embedding_count INTEGER DEFAULT 0, -- Number of stored embeddings

    -- Statistics
    visit_count INTEGER DEFAULT 1,
    first_seen TIMESTAMP WITH TIME ZONE,
    last_seen TIMESTAMP WITH TIME ZONE,
    cameras_seen TEXT[], -- Array of camera IDs

    -- User notes
    notes TEXT,
    tags TEXT[], -- e.g., ['family', 'delivery', 'service']

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_visitors_name ON visitors(name);
CREATE INDEX idx_visitors_type ON visitors(type);
CREATE INDEX idx_visitors_active ON visitors(is_active);
CREATE INDEX idx_visitors_last_seen ON visitors(last_seen DESC);

-- Visitor events mapping table
CREATE TABLE IF NOT EXISTS visitor_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id UUID NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    face_id TEXT, -- Face detection ID in event
    confidence FLOAT, -- Recognition confidence
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(visitor_id, event_id)
);

CREATE INDEX idx_visitor_events_visitor ON visitor_events(visitor_id);
CREATE INDEX idx_visitor_events_event ON visitor_events(event_id);

-- Comments
COMMENT ON TABLE visitors IS 'Managed visitors with photos and metadata';
COMMENT ON TABLE visitor_events IS 'Mapping between visitors and events';
COMMENT ON COLUMN visitors.type IS 'Visitor type: known or unknown';
COMMENT ON COLUMN visitors.embedding_count IS 'Number of face embeddings stored for this visitor';
COMMENT ON COLUMN visitors.cameras_seen IS 'Array of camera IDs where visitor was detected';
