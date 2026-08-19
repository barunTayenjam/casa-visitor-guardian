-- Migration 032: Allow NULL events.file_path
-- When no snapshot frame is available the pipeline used to write '' — which
-- collides on idx_events_file_path_unique and kills persistence for every
-- subsequent frameless event. NULL sidesteps the unique index (Postgres
-- allows repeated NULLs) and such events are already excluded from listing
-- queries that require a file.

ALTER TABLE events ALTER COLUMN file_path DROP NOT NULL;
