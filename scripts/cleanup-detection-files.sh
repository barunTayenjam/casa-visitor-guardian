#!/bin/bash
# Clean up orphaned detection files records

echo "=== Step 1: Find records with /data/detections paths that don't exist ==="

# Get records with /data/detections paths
docker exec sentryvision-postgres psql -U sentryvision -d sentryvision -t -c "
SELECT id, storage_path FROM detection_files 
WHERE storage_path LIKE '/data/detections%' 
AND file_type IN ('event_motion', 'event_face');
" 2>/dev/null | while read id path; do
    if [ -n "$id" ] && [ -n "$path" ]; then
        # Convert path from /data to /app/data
        new_path=$(echo "$path" | sed 's|/data/detections|/app/data/detections|')
        # Check if file exists at new path
        if docker exec sentryvision-backend test -f "$new_path" 2>/dev/null; then
            echo "EXISTS (will update): $id -> $new_path"
        else
            echo "MISSING (will delete): $id -> $path"
        fi
    fi
done

echo ""
echo "=== Step 2: Delete orphaned records ==="

# Delete records where file doesn't exist
docker exec sentryvision-postgres psql -U sentryvision -d sentryvision -c "
DELETE FROM detection_files 
WHERE storage_path LIKE '/data/detections%' 
AND (
    storage_path NOT LIKE '/app/data/detections%' 
    OR NOT EXISTS (
        SELECT 1 FROM detection_files df2 
        WHERE df2.storage_path = REPLACE(detection_files.storage_path, '/data/detections', '/app/data/detections')
    )
);
" 2>/dev/null

echo ""
echo "=== Step 3: Update paths that do exist ==="

# Update paths that exist
docker exec sentryvision-postgres psql -U sentryvision -d sentryvision -c "
UPDATE detection_files 
SET storage_path = REPLACE(storage_path, '/data/detections', '/app/data/detections')
WHERE storage_path LIKE '/data/detections%';
" 2>/dev/null

echo ""
echo "=== Verification ==="
docker exec sentryvision-postgres psql -U sentryvision -d sentryvision -t -c "SELECT COUNT(*) FROM detection_files WHERE storage_path LIKE '/data/detections%';" 2>/dev/null
echo "Remaining records with /data/detections path: $(docker exec sentryvision-postgres psql -U sentryvision -d sentryvision -t -c "SELECT COUNT(*) FROM detection_files WHERE storage_path LIKE '/data/detections%';" 2>/dev/null)"
