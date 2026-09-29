#!/bin/bash
# Auto-rerun face clustering in chunks until all images are processed.
# Each run: 5000 images max, 0.5 CPU, auto-removed when done.
# Repeats until the checkpoint covers all images.

set -e
cd "$(dirname "$0")"/..

# Load secrets (POSTGRES_PASSWORD etc.)
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

MAX_RUNS=${1:-15}   # safety cap: 15 runs × 5000 = 75K images
RUN=0

while [ $RUN -lt $MAX_RUNS ]; do
  RUN=$((RUN + 1))
  echo "[clustering-loop] Run $RUN/$MAX_ROWS starting at $(date)"
  docker run --rm --name face-clustering \
    --network sentryvision_sentryvision_network \
    --cpus=0.5 \
    --memory=512m \
    -e POSTGRES_HOST=postgres -e POSTGRES_PORT=5432 -e POSTGRES_DB=sentryvision \
    -e POSTGRES_USER=sentryvision -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
    -e CLUSTER_MAX_IMAGES=5000 \
    -v "$(pwd)/opencv-service/cluster_and_populate.py:/app/cluster_and_populate.py:ro" \
    -v "$(pwd)/opencv-service/arcface_recognizer.py:/app/arcface_recognizer.py:ro" \
    -v "$(pwd)/opencv-service/models:/app/models:ro" \
    -v "$(pwd)/opencv-service/known_faces:/app/known_faces:ro" \
    -v "$(pwd)/data:/app/data" \
    -v "$(pwd)/opencv-service/.insightface:/root/.insightface:ro" \
    --entrypoint python3 \
    sentryvision-opencv /app/cluster_and_populate.py

  # Check remaining count
  REMAINING=$(docker run --rm \
    -v "$(pwd)/data:/app/data:ro" \
    --entrypoint python3 \
    sentryvision-opencv -c "
import json, os
ckpt = '/app/data/clustering_checkpoint.json'
total = 0
for root, dirs, files in os.walk('/app/data/detections'):
    total += sum(1 for f in files if f.endswith('.jpg') and not f.startswith('._'))
done = len(json.load(open(ckpt))['processed_paths']) if os.path.exists(ckpt) else 0
print(max(0, total - done))
" 2>/dev/null || echo 0)

  echo "[clustering-loop] Run $RUN done, $REMAINING images remaining"

  if [ "$REMAINING" -eq 0 ]; then
    echo "[clustering-loop] All images processed!"
    break
  fi

  # Brief pause between runs
  sleep 10
done

echo "[clustering-loop] Finished after $RUN runs"
