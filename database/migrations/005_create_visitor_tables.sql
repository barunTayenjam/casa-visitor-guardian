-- Migration: Create visitor tables (PostgreSQL version)
-- This replaces SQLite-based visitor tables with PostgreSQL

-- Visitor reports table
CREATE TABLE IF NOT EXISTS visitor_reports (
  id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_visits INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  known_visitors INTEGER DEFAULT 0,
  unknown_visitors INTEGER DEFAULT 0,
  report_data TEXT NOT NULL,
  file_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Visitor schedules table
CREATE TABLE IF NOT EXISTS visitor_schedules (
  id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
  cron_expression TEXT NOT NULL,
  recipients TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Visitor timeline table - stores individual visitor events and timeline data
CREATE TABLE IF NOT EXISTS visitor_timeline (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  camera_id TEXT NOT NULL,
  visitor_type TEXT NOT NULL CHECK (visitor_type IN ('known', 'unknown')),
  visitor_id TEXT,
  visitor_name TEXT,
  first_seen TIMESTAMP NOT NULL,
  last_seen TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0.0,
  visit_count INTEGER DEFAULT 1,
  photo_paths TEXT,
  camera_ids TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_visitor_reports_type_period ON visitor_reports(report_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_schedules_enabled ON visitor_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_visitor_timeline_date ON visitor_timeline(date);
CREATE INDEX IF NOT EXISTS idx_visitor_timeline_camera ON visitor_timeline(camera_id);
CREATE INDEX IF NOT EXISTS idx_visitor_timeline_visitor_type ON visitor_timeline(visitor_type);
CREATE INDEX IF NOT EXISTS idx_visitor_timeline_first_seen ON visitor_timeline(first_seen);

-- Add comments
COMMENT ON TABLE visitor_reports IS 'Stores generated visitor reports';
COMMENT ON TABLE visitor_schedules IS 'Stores scheduled visitor report configurations';
COMMENT ON TABLE visitor_timeline IS 'Stores detailed visitor tracking data';
