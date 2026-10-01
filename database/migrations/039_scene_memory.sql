-- Scene memory baselines: learned during calm windows only, compared at event time
CREATE TABLE IF NOT EXISTS scene_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id TEXT NOT NULL,
  time_slot TEXT NOT NULL,          -- 'day' | 'night'
  baseline_caption TEXT,
  baseline_fingerprint JSONB,       -- {mean_luma, brightness, mean_rgb}
  baseline_objects JSONB,           -- {class: count}
  confidence REAL DEFAULT 1.0,
  sample_count INT DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (camera_id, time_slot)
);

CREATE INDEX IF NOT EXISTS idx_scene_memory_camera_slot ON scene_memory (camera_id, time_slot);
