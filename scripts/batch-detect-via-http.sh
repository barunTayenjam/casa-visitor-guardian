#!/bin/bash
# Batch detect images using OpenCV HTTP API and update database
# Usage: ./batch-detect.sh <image_path> [<image_path>...]
#   or: find /path -name '*.jpg' | ./batch-detect.sh -

set -e

OPENCV_URL="${OPENCV_URL:-http://localhost:8084}"
PSQL="docker exec -i sentryvision-postgres psql -U sentryvision -d sentryvision -q -t"

# Get images (from command line or stdin)
if [ "$1" = "-" ]; then
    IMAGE_PATHS=$(cat)
    shift
else
    IMAGE_PATHS="$@"
fi

if [ -z "$IMAGE_PATHS" ]; then
    echo "Usage: $0 <image_path> [<image_path>...]"
    echo "   or: find /path -name '*.jpg' | $0 -"
    exit 1
fi

echo "Processing images using OpenCV service at $OPENCV_URL..."
echo ""

COUNT=0
SUCCESS=0
for IMAGE_PATH in $IMAGE_PATHS; do
    COUNT=$((COUNT + 1))
    echo "[$COUNT] Processing: $IMAGE_PATH"

    # Check if file exists
    if [ ! -f "$IMAGE_PATH" ]; then
        echo "  -> File not found, skipping"
        continue
    fi

    # Calculate file hash and size
    FILE_HASH=$(sha256sum "$IMAGE_PATH" | cut -d' ' -f1)
    FILE_SIZE=$(stat -c%s "$IMAGE_PATH")

    # Call OpenCV detect-objects endpoint
    RESPONSE=$(curl -s -X POST "$OPENCV_URL/detect-objects" \
        -F "image=@$IMAGE_PATH" \
        -F "fileHash=$FILE_HASH" \
        -F "fileSize=$FILE_SIZE" \
        -F "fileModified=")

    # Parse response
    SUCCESS_FLAG=$(echo "$RESPONSE" | grep -o '"success":true' || echo "")
    PROCESSING_TIME=$(echo "$RESPONSE" | grep -o '"processingTime":[0-9.]*' | cut -d':' -f2 || echo "0")

    if [ -n "$SUCCESS_FLAG" ]; then
        # Count detections by class
        PERSONS=$(echo "$RESPONSE" | grep -o '"class":"person"' | wc -l)
        FACES=$(echo "$RESPONSE" | grep -o '"class":"face"' | wc -l)
        echo "  -> Success! Processing time: ${PROCESSING_TIME}ms, Detections: $PERSONS persons, $FACES faces"

        # Get detections array from response
        DETECTIONS=$(echo "$RESPONSE" | sed -n 's/.*"detections":\(\[.*\]\).*/\1/p')
        if [ -z "$DETECTIONS" ]; then
            DETECTIONS="[]"
        fi

        DETECTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        FILE_TYPE="event_face"

        # Use Python to create proper JSON and insert into database
        python3 << PYEOF
import subprocess
import json
import sys

image_path = """$IMAGE_PATH"""
file_hash = """$FILE_HASH"""
file_size = $FILE_SIZE
detections_str = """$DETECTIONS"""
processing_time = float($PROCESSING_TIME)
detected_at = """$DETECTED_AT"""
file_type = """$FILE_TYPE"""

# Parse detections
try:
    if detections_str.startswith('[') and detections_str.endswith(']'):
        detections = json.loads(detections_str)
    else:
        detections = []
except:
    detections = []

# Build metadata
metadata = {
    "detections": detections,
    "processing_time_ms": processing_time,
    "detected_at": detected_at,
    "detection_types": list(set(d.get("class", "unknown") for d in detections))
}

# Escape for SQL
metadata_json = json.dumps(metadata).replace("'", "''")

# Insert or update
sql = f"""
DO \$\$
BEGIN
    IF EXISTS (SELECT 1 FROM detection_files WHERE file_hash = '{file_hash}') THEN
        UPDATE detection_files SET metadata = '{metadata_json}'::jsonb, updated_at = NOW() WHERE file_hash = '{file_hash}';
    ELSE
        INSERT INTO detection_files (file_type, storage_path, file_hash, file_size, metadata)
        VALUES ('{file_type}', '{image_path}', '{file_hash}', {file_size}, '{metadata_json}'::jsonb);
    END IF;
END
\$\$;
"""

result = subprocess.run(
    ["docker", "exec", "-i", "sentryvision-postgres", "psql", "-U", "sentryvision", "-d", "sentryvision", "-q", "-t"],
    input=sql.encode(),
    capture_output=True
)

if result.returncode == 0:
    print("  -> Database updated successfully")
    sys.exit(0)
else:
    print(f"  -> Database error: {result.stderr.decode()[:100]}")
    sys.exit(1)
PYEOF

        if [ $? -eq 0 ]; then
            SUCCESS=$((SUCCESS + 1))
        fi
    else
        echo "  -> Detection failed"
        echo "     Response: $(echo "$RESPONSE" | head -c 200)"
    fi
    echo ""
done

echo "========================================"
echo "Completed: $COUNT images processed, $SUCCESS successful"
