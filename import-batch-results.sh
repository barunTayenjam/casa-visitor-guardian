#!/bin/bash
# Import batch results to PostgreSQL
# Handles CSV with pipe delimiter to avoid JSON conflicts

set -e

echo "=== Importing Batch Results ==="
echo ""

# Import batch jobs (6 records)
echo "Importing batch jobs..."
cat data/detections/batch_jobs_import.sql | docker exec -i sentryvision-db psql -U sentryvision -d sentryvision
echo "✅ Batch jobs imported"
echo ""

# Import batch result items via COPY with pipe delimiter
echo "Importing batch result items (86,901 records)..."
docker cp data/detections/batch_result_items.csv sentryvision-db:/tmp/batch_result_items.csv

docker exec sentryvision-db psql -U sentryvision -d sentryvision -c "
TRUNCATE batch_result_items;
"

docker exec sentryvision-db psql -U sentryvision -d sentryvision <<'EOF'
\copy batch_result_items FROM '/tmp/batch_result_items.csv' WITH (FORMAT csv, HEADER true, DELIMITER '|', NULL '\\N')
EOF

# Get counts
BATCH_JOBS=$(docker exec sentryvision-db psql -U sentryvision -d sentryvision -tAc "SELECT COUNT(*) FROM batch_jobs;")
BATCH_ITEMS=$(docker exec sentryvision-db psql -U sentryvision -d sentryvision -tAc "SELECT COUNT(*) FROM batch_result_items;")

echo ""
echo "=== Import Summary ==="
echo "✅ Batch jobs imported: $BATCH_JOBS"
echo "✅ Result items imported: $BATCH_ITEMS"
echo ""

# Mark batch jobs as completed
docker exec sentryvision-db psql -U sentryvision -d sentryvision <<'EOF'
UPDATE batch_jobs SET completed_at = NOW(), started_at = NOW() WHERE completed_at IS NULL;
EOF

echo "✅ Batch jobs marked as completed"
echo ""

# Clean up
rm -f data/detections/batch_jobs_import.sql data/detections/batch_result_items.csv
echo "🗑️  Cleanup complete"

echo ""
echo "=== Verification ==="
docker exec sentryvision-db psql -U sentryvision -d sentryvision <<'EOF'
SELECT
  bj.job_type,
  bj.status,
  bj.total_images,
  bj.person_detections,
  bj.face_detections,
  COUNT(bri.id) as result_items_count
FROM batch_jobs bj
LEFT JOIN batch_result_items bri ON bj.id = bri.batch_job_id
GROUP BY bj.id, bj.job_type, bj.status, bj.total_images, bj.person_detections, bj.face_detections
LIMIT 5;
EOF

echo ""
echo "✅ Batch results now stored in database instead of JSON files!"
