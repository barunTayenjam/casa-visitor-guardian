-- Capture full PersonAnalyzer output + face embedding per detection,
-- and MOG2 motion stats per event.
ALTER TABLE event_detections ADD COLUMN person_attributes jsonb;
ALTER TABLE event_detections ADD COLUMN face_embedding jsonb;
ALTER TABLE events ADD COLUMN motion_stats jsonb;