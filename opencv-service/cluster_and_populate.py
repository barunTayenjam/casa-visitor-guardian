#!/usr/bin/env python3
"""Cluster face embeddings from event images and populate DB.

1. Scan event images, extract face embeddings
2. Cluster by cosine similarity (lenient threshold for surveillance)
3. Save representative crops to /app/data/face_crops/
4. Insert clusters + embeddings into PostgreSQL

Run inside opencv container:
    docker exec sentryvision-opencv python3 cluster_and_populate.py
"""

import json
import os
import sys
import time

import cv2
import numpy as np
import psycopg2

sys.path.insert(0, '/app')
from arcface_recognizer import arcface_recognizer

# MediaPipe as secondary detector — catches faces RetinaFace misses
import mediapipe as mp
_mp_face_detection = mp.solutions.face_detection.FaceDetection(
    model_selection=1, min_detection_confidence=0.3)

EVENTS_ROOT = '/app/data/detections'
FACE_CROPS_DIR = '/app/data/face_crops'
CLUSTERING_JSON = '/app/face_clustering.json'
STATUS_FILE = '/app/data/clustering_status.json'
CHECKPOINT_FILE = '/app/data/clustering_checkpoint.json'
CLUSTER_THRESHOLD = float(os.environ.get('CLUSTER_THRESHOLD', '0.6'))
# Old 0.8 threshold merged everything into one cluster. 0.6 for same-person.
MAX_IMAGES = int(os.environ.get('CLUSTER_MAX_IMAGES', '2000'))  # chunked: default 2000/run
NICE_LEVEL = 19  # lowest priority — live pipeline always wins
CHECKPOINT_EVERY = 50  # write checkpoint every N images


def write_status(images_scanned: int, total_images: int, faces_found: int,
                 clusters_created: int = 0, multi_face_clusters: int = 0,
                 estimated_remaining_minutes: float = 0, resumed: bool = False,
                 already_processed: int = 0) -> None:
    """Write clustering progress to a status file the backend reads."""
    try:
        with open(STATUS_FILE, 'w') as f:
            json.dump({
                'imagesScanned': images_scanned,
                'totalImages': total_images,
                'facesFound': faces_found,
                'clustersCreated': clusters_created,
                'multiFaceClusters': multi_face_clusters,
                'lastUpdate': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'estimatedRemainingMinutes': round(estimated_remaining_minutes, 1),
                'resumed': resumed,
                'alreadyProcessed': already_processed,
            }, f)
    except Exception as e:
        print(f'  Status write failed: {e}', flush=True)


def load_checkpoint() -> set:
    """Load set of already-processed image paths from the checkpoint file."""
    try:
        if os.path.exists(CHECKPOINT_FILE):
            with open(CHECKPOINT_FILE) as f:
                data = json.load(f)
            paths = data.get('processed_paths', [])
            print(f'  Resuming: {len(paths)} images already processed', flush=True)
            return set(paths)
    except Exception as e:
        print(f'  Checkpoint load failed ({e}) — starting fresh', flush=True)
    return set()


def append_checkpoint(paths: list) -> None:
    """Append newly processed paths to the checkpoint (atomic-ish rewrite)."""
    try:
        existing = load_checkpoint() if os.path.exists(CHECKPOINT_FILE) else set()
        existing.update(paths)
        tmp = CHECKPOINT_FILE + '.tmp'
        with open(tmp, 'w') as f:
            json.dump({'processed_paths': sorted(existing)}, f)
        os.replace(tmp, CHECKPOINT_FILE)
    except Exception as e:
        print(f'  Checkpoint write failed: {e}', flush=True)


def detect_face_in_roi(person_roi):
    """Combined RetinaFace + MediaPipe detection on a person ROI.

    Returns (embedding, det_score, bbox_in_roi) or None.
    RetinaFace primary (gives embedding directly); MediaPipe fallback
    (detection only — crop + recognizer model for embedding).
    """
    scale = 1.0
    if person_roi.shape[0] < 160 or person_roi.shape[1] < 160:
        scale = max(160 / person_roi.shape[0], 160 / person_roi.shape[1])
        person_roi = cv2.resize(person_roi, None, fx=scale, fy=scale,
                                interpolation=cv2.INTER_CUBIC)
    rgb = cv2.cvtColor(person_roi, cv2.COLOR_BGR2RGB)

    # Primary: RetinaFace — detection + embedding in one call
    try:
        dets = arcface_recognizer._app.get(rgb)
        best = max((d for d in dets if d.det_score > 0.3),
                   key=lambda d: d.det_score, default=None)
        if best is not None:
            emb = best.embedding / np.linalg.norm(best.embedding)
            return emb.astype(np.float64), float(best.det_score), best.bbox.astype(int)
    except Exception:
        pass

    # Fallback: MediaPipe — detection only, then recognizer for embedding
    try:
        result = _mp_face_detection.process(rgb)
        if result.detections:
            det = max(result.detections, key=lambda d: d.score[0])
            bb = det.location_data.relative_bounding_box
            ih, iw = person_roi.shape[:2]
            fx, fy = int(bb.xmin * iw), int(bb.ymin * ih)
            fw, fh = int(bb.width * iw), int(bb.height * ih)
            face_crop = person_roi[max(0, fy):fy + fh, max(0, fx):fx + fw]
            if face_crop.size > 0 and fw >= 30 and fh >= 30:
                emb = arcface_recognizer.extract_face_embedding(face_crop)
                if emb is not None and len(emb) == 512:
                    return emb, float(det.score[0]), [fx, fy, fx + fw, fy + fh]
    except Exception:
        pass

    return None


def scan_and_embed():
    """Scan person-detection events from DB, extract verified face embeddings.

    Queries events WITH person bounding boxes (from DB), crops the person
    region from the full-res image, and runs RetinaFace+MediaPipe detection
    to get quality-verified face embeddings. Checkpoint/resume works the
    same — checkpoint tracks event IDs, not file paths.
    """
    try:
        os.nice(NICE_LEVEL)
    except Exception:
        pass

    processed = load_checkpoint()

    # Query DB for person events with bboxes — skip already checkpointed
    conn = psycopg2.connect(
        host=os.environ.get('POSTGRES_HOST', 'postgres'),
        port=int(os.environ.get('POSTGRES_PORT', '5432')),
        database=os.environ.get('POSTGRES_DB', 'sentryvision'),
        user=os.environ.get('POSTGRES_USER', 'sentryvision'),
        password=os.environ.get('POSTGRES_PASSWORD'),
    )
    cur = conn.cursor()
    cur.execute(
        """SELECT id, file_path, timestamp, object_detections, confidence
           FROM events
           WHERE object_detections::text LIKE '%%person%%'
             AND file_path IS NOT NULL AND file_path != ''
           ORDER BY timestamp DESC"""
    )
    all_rows = cur.fetchall()
    cur.close()
    conn.close()

    total = len(all_rows)
    pending = [r for r in all_rows if str(r[0]) not in processed]
    chunk = pending[:MAX_IMAGES]
    done_before = len(processed)

    if not chunk:
        print('  Nothing new to process — all events already in checkpoint', flush=True)
        write_status(0, total, 0, resumed=True, already_processed=done_before)
        return [], []

    print(f'  {done_before}/{total} events done, processing next {len(chunk)}', flush=True)

    face_crops = []
    face_metadata = []
    count = 0
    new_ids = []
    start_time = time.time()

    for row in chunk:
        event_id, path, ts, dets, _ = row
        image = cv2.imread(path)
        if image is None:
            count += 1
            new_ids.append(str(event_id))
            continue

        img_h, img_w = image.shape[:2]

        for det in (dets or []):
            if not isinstance(det, dict) or det.get('class') != 'person':
                continue
            bb = det.get('bbox', {})
            px, py, pw, ph = int(bb.get('x', 0)), int(bb.get('y', 0)), int(bb.get('width', 0)), int(bb.get('height', 0))
            x0, y0 = max(0, px), max(0, py)
            x1, y1 = min(img_w, px + pw), min(img_h, py + ph)
            if x1 - x0 < 30 or y1 - y0 < 30:
                continue

            person_roi = image[y0:y1, x0:x1]
            result = detect_face_in_roi(person_roi)
            if result is not None:
                emb, det_score, bbox = result
                bx0, by0, bx1, by1 = bbox
                face_crops.append(emb)
                face_metadata.append({
                    'image': os.path.basename(path),
                    'path': path,
                    'bbox': [int(x0 + bx0), int(y0 + by0), int(bx1 - bx0), int(by1 - by0)],
                    'event_time': str(ts),
                    'event_id': str(event_id),
                    'det_score': det_score,
                })

        count += 1
        new_ids.append(str(event_id))

        if count % 10 == 0:
            time.sleep(0.05)
        if count % 100 == 0:
            append_checkpoint(new_ids)
            new_ids = []
            elapsed = time.time() - start_time
            rate = count / elapsed if elapsed > 0 else 1
            remaining = (len(chunk) - count) / rate / 60 if rate > 0 else 0
            write_status(done_before + count, total, len(face_crops),
                         estimated_remaining_minutes=remaining, resumed=True,
                         already_processed=done_before)
            print(f'  Chunk progress {count}/{len(chunk)} — total {done_before + count}/{total}, '
                  f'{len(face_crops)} faces in this chunk', flush=True)

    append_checkpoint(new_ids)
    write_status(done_before + count, total, len(face_crops),
                 estimated_remaining_minutes=0, resumed=True,
                 already_processed=done_before)
    print(f'  Chunk complete: {count} events, {len(face_crops)} faces this run', flush=True)
    return face_crops, face_metadata


def cluster_faces(face_crops, face_metadata, threshold):
    """Cluster faces by embedding similarity."""
    if len(face_crops) < 2:
        return []

    embeddings = np.array(face_crops)
    n = len(embeddings)

    # Vectorized pairwise distance
    dists = np.linalg.norm(embeddings[:, None] - embeddings[None, :], axis=2)

    clusters = []
    assigned = [False] * n
    for i in range(n):
        if assigned[i]:
            continue
        cluster = [i]
        assigned[i] = True
        for j in range(i+1, n):
            if not assigned[j] and dists[i][j] < threshold:
                cluster.append(j)
                assigned[j] = True
        clusters.append(cluster)

    return clusters


def save_to_db(clusters, face_metadata, face_crops):
    """Persist clusters and embeddings in PostgreSQL."""
    os.makedirs(FACE_CROPS_DIR, exist_ok=True)

    conn = psycopg2.connect(
        host=os.environ.get('POSTGRES_HOST', 'postgres'),
        port=int(os.environ.get('POSTGRES_PORT', '5432')),
        database=os.environ.get('POSTGRES_DB', 'sentryvision'),
        user=os.environ.get('POSTGRES_USER', 'sentryvision'),
        password=os.environ.get('POSTGRES_PASSWORD'),
    )
    cur = conn.cursor()

    # Clear previous auto-clustered rows
    cur.execute("DELETE FROM face_clusters WHERE name IS NULL OR name = ''")

    inserted_clusters = 0
    inserted_embeddings = 0  # embeddings kept in face_clustering.json, not DB

    for ci, cluster_indices in enumerate(clusters):
        size = len(cluster_indices)
        if size < 2:
            continue  # skip noise singletons — real people repeat across events
        person_id = f'person_{ci+1:03d}'

        # Representative: best quality (largest face)
        rep_idx = max(cluster_indices, key=lambda i: face_metadata[i]['bbox'][2] * face_metadata[i]['bbox'][3])
        rep_meta = face_metadata[rep_idx]

        # Save representative crop
        rep_crop_path = None
        try:
            image = cv2.imread(rep_meta['path'])
            if image is not None:
                x, y, w, h = rep_meta['bbox']
                face_roi = image[y:y+h, x:x+w]
                if face_roi.size > 0:
                    rep_crop_path = os.path.join(FACE_CROPS_DIR, f'{person_id}_rep.jpg')
                    cv2.imwrite(rep_crop_path, face_roi)
        except Exception as e:
            print(f'    Crop save failed for {person_id}: {e}')

        # Compute average embedding for this cluster
        avg_emb = np.mean([face_crops[i] for i in cluster_indices], axis=0)
        avg_emb_list = avg_emb.tolist()

        cur.execute(
            """INSERT INTO face_clusters (cluster_id, name, image_path, embedding_quality, face_count, description, embedding_avg_512)
               VALUES (%s, NULL, %s, %s, %s, %s, %s)
               ON CONFLICT DO NOTHING""",
            (person_id, rep_crop_path, None, size,
             f'{size} appearance{"s" if size > 1 else ""}',
             avg_emb_list)
        )
        inserted_clusters += 1

    conn.commit()
    cur.close()
    conn.close()

    print(f'  DB inserted: {inserted_clusters} clusters, {inserted_embeddings} embeddings')

    # Final status update
    multi = sum(1 for ci in range(inserted_clusters))
    write_status(0, 0, inserted_embeddings,
                 clusters_created=inserted_clusters,
                 multi_face_clusters=0, estimated_remaining_minutes=0)


def main():
    # Only clear the status file's "finished" state if starting a fresh full scan —
    # resumable chunks never wipe each other's progress because faces accumulate.
    print('=== Face Clustering Pipeline (resumable) ===')
    print('\n1. Scanning event images and extracting embeddings...')
    face_crops, face_metadata = scan_and_embed()

    if not face_crops:
        print('  No new faces in this chunk — keeping existing DB clusters', flush=True)
        return

    print(f'\n2. Clustering {len(face_crops)} faces (threshold={CLUSTER_THRESHOLD})...')
    clusters = cluster_faces(face_crops, face_metadata, CLUSTER_THRESHOLD)
    print(f'  Found {len(clusters)} unique persons in this chunk')

    # Save clustering JSON
    result = {
        'threshold': CLUSTER_THRESHOLD,
        'total_faces': len(face_crops),
        'clusters': [
            {
                'person_id': f'person_{ci+1:03d}',
                'size': len(indices),
                'images': [face_metadata[i] for i in indices]
            }
            for ci, indices in enumerate(clusters)
        ]
    }
    with open(CLUSTERING_JSON, 'w') as f:
        json.dump(result, f)
    print(f'  Saved to {CLUSTERING_JSON}')

    print('\n3. Saving to database...')
    save_to_db(clusters, face_metadata, face_crops)

    # Summary
    multi = [c for c in clusters if len(c) > 1]
    print(f'\n=== Summary ===')
    print(f'Total faces: {len(face_crops)}')
    print(f'Unique persons: {len(clusters)}')
    print(f'Multi-appearance: {len(multi)}')
    print(f'Top appearances: {sorted([len(c) for c in clusters], reverse=True)[:5]}')


if __name__ == '__main__':
    main()
