-- Backfill event_detections from existing events.object_detections JSONB.
-- One row per detection in each persisted event. Safe to re-run (idempotent —
-- skips event_ids already present). Numeric JSONB values arrive as float
-- strings ("341.9"), so cast through float before narrowing to int.

INSERT INTO event_detections (
    event_id, camera_id, timestamp, class, class_id, confidence,
    bbox_x, bbox_y, bbox_w, bbox_h,
    track_id, track_state, tracklet_len,
    identity, identity_confidence,
    human_verified, verification_tier
)
SELECT
    e.id,
    e.camera_id,
    e.timestamp,
    d->>'class' AS class,
    round((d->>'classId')::float)::int AS class_id,
    -- Legacy object_detections persisted confidence as 0-100 (rounded);
    -- event_detections uses the 0-1 scale everywhere.
    ((d->>'confidence')::float / 100.0) AS confidence,
    round((d->'bbox'->>'x')::float)::int AS bbox_x,
    round((d->'bbox'->>'y')::float)::int AS bbox_y,
    round((d->'bbox'->>'width')::float)::int AS bbox_w,
    round((d->'bbox'->>'height')::float)::int AS bbox_h,
    round((d->>'trackId')::float)::int AS track_id,
    d->>'trackState' AS track_state,
    round((d->>'trackletLen')::float)::int AS tracklet_len,
    d->>'identity' AS identity,
    (d->>'identityConfidence')::float AS identity_confidence,
    (d->>'humanVerified')::boolean AS human_verified,
    d->>'verificationTier' AS verification_tier
FROM events e
CROSS JOIN LATERAL jsonb_array_elements(e.object_detections) AS d
LEFT JOIN event_detections ed ON ed.event_id = e.id
WHERE ed.id IS NULL
  AND jsonb_array_length(e.object_detections) > 0;