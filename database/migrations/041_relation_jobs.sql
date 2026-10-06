-- Durable queue for relation enrichment jobs.
-- The backend worker claims rows with FOR UPDATE SKIP LOCKED and processes
-- them continuously; events.relations IS NULL + a missing/done job never
-- happens because persistDetectionEvent enqueues in the same flow.
CREATE TABLE IF NOT EXISTS relation_jobs (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_relation_jobs_event ON relation_jobs (event_id);
CREATE INDEX IF NOT EXISTS idx_relation_jobs_claim
  ON relation_jobs (status, next_attempt_at) WHERE status = 'pending';

COMMENT ON TABLE relation_jobs IS 'Durable DB queue for relation enrichment (status: pending/processing/done/failed)';
