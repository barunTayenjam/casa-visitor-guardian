-- RelateAnything scene-relation triplets per event.
-- NULL = never analyzed, [] = analyzed with no relations passing the threshold.
ALTER TABLE events ADD COLUMN IF NOT EXISTS relations JSONB;

COMMENT ON COLUMN events.relations IS 'RelateAnything relation triplets (subject, predicate, object, score, subjectIndex, objectIndex)';
