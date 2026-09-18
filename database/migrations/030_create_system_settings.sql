-- Migration 030: Create system_settings table
-- Mirrors the schema consumed by SettingsController (general/storage/notification
-- settings row). Idempotent so environments where the table was created manually
-- converge safely.

CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_name VARCHAR(255),
    timezone VARCHAR(255),
    language VARCHAR(50),
    theme VARCHAR(50),
    auto_backup BOOLEAN,
    backup_frequency VARCHAR(50),
    retention_days INTEGER,
    max_storage_gb INTEGER,
    auto_cleanup BOOLEAN,
    compression_enabled BOOLEAN,
    compression_quality INTEGER,
    email_enabled BOOLEAN,
    email_address VARCHAR(255),
    push_enabled BOOLEAN,
    push_sound_enabled BOOLEAN,
    quiet_hours_enabled BOOLEAN,
    quiet_hours_start VARCHAR(10),
    quiet_hours_end VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
