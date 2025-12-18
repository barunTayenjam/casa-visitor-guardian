-- File: database/migrations/003_create_events_table.sql

-- Events table for motion detection and security events
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    thumbnail_path VARCHAR(255),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    camera_id VARCHAR(100),
    metadata TEXT
);

-- Indexes for performance
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_camera_id ON events(camera_id);