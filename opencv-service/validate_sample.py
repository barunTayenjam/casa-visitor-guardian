#!/usr/bin/env python3
"""Build a 200-image test set from DB person detections and validate clustering.

1. Query DB for 200 recent person-detect events
2. Extract face crops + embeddings (same pipeline as production)
3. Cluster them, report quality metrics
4. Save accepted clusters to DB with crops visible on People page

This is the validation harness: run it, inspect results, tune thresholds,
*then* run the full pipeline with confidence.

Usage:
    docker exec sentryvision-opencv python3 validate_sample.py [--limit N] [--threshold T]
"""

import argparse
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

FACE_CROPS_DIR = '/app/data/face_crops'
MIN_FACE_SIZE = 40
DEFAULT_LIMIT = 200
DEFAULT_THRESHOLD = 0.8


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


def get_test_images(limit: int):
    """Query DB for recent person-detection event image paths + person bboxes."""
    conn = psycopg2.connect(
        host=os.environ.get('POSTGRES_HOST', 'postgres'),
        port=int(os.environ.get('POSTGRES_PORT', '5432')),
        database=os.environ.get('POSTGRES_DB', 'sentryvision'),
        user=os.environ.get('POSTGRES_USER', 'sentryvision'),
        password=os.environ.get('POSTGRES_PASSWORD'),
    )
    cur = conn.cursor()
    cur.execute(
        """
        SELECT file_path, timestamp, confidence, object_detections
        FROM events
        WHERE object_detections::text LIKE '%%person%%'
          AND file_path IS NOT NULL AND file_path != ''
        ORDER BY timestamp DESC
        LIMIT %s
        """, (limit,))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    images = []
    for r in rows:
        detections = r[3] or []
        # Extract person bounding boxes
        person_boxes = []
        for det in detections:
            if isinstance(det, dict) and det.get('class') == 'person':
                bbox = det.get('bbox', {})
                if isinstance(bbox, dict):
                    person_boxes.append((bbox.get('x', 0), bbox.get('y', 0),
                                         bbox.get('width', 0), bbox.get('height', 0)))
        if person_boxes:
            images.append((r[0], r[1], float(r[2]) if r[2] else 0.0, person_boxes))
    return images


def extract_embeddings(image_paths):
    """Extract verified face embeddings from person ROIs using combined detector."""
    face_crops = []
    face_metadata = []

    for i, (path, ts, conf, person_boxes) in enumerate(image_paths):
        image = cv2.imread(path)
        if image is None:
            continue
        img_h, img_w = image.shape[:2]

        # DB bboxes are in 640x360 YOLO space — scale to this image's resolution
        sx, sy = img_w / 640, img_h / 360

        for (px, py, pw, ph) in person_boxes:
            x0, y0 = max(0, int(px * sx)), max(0, int(py * sy))
            x1, y1 = min(img_w, int((px + pw) * sx)), min(img_h, int((py + ph) * sy))
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
                    'det_score': det_score,
                })

        if (i + 1) % 50 == 0:
            print(f'  {i + 1}/{len(image_paths)} — {len(face_crops)} faces so far', flush=True)

    print(f'  Extracted {len(face_crops)} verified faces from {len(image_paths)} images', flush=True)
    return face_crops, face_metadata


def cluster_faces(embeddings, threshold):
    """Greedy clustering by L2 distance. Returns list of index lists."""
    if len(embeddings) < 2:
        return [[i] for i in range(len(embeddings))]
    arr = np.array(embeddings)
    n = len(arr)
    dists = np.linalg.norm(arr[:, None] - arr[None, :], axis=2)

    clusters, assigned = [], [False] * n
    for i in range(n):
        if assigned[i]:
            continue
        cluster = [i]
        assigned[i] = True
        for j in range(i + 1, n):
            if not assigned[j] and dists[i][j] < threshold:
                cluster.append(j)
                assigned[j] = True
        clusters.append(cluster)
    return clusters


def save_clusters_to_db(clusters, face_metadata, face_crops):
    """Save clusters (size >= 2 only) to face_clusters + representative crops."""
    os.makedirs(FACE_CROPS_DIR, exist_ok=True)

    conn = psycopg2.connect(
        host=os.environ.get('POSTGRES_HOST', 'postgres'),
        port=int(os.environ.get('POSTGRES_PORT', '5432')),
        database=os.environ.get('POSTGRES_DB', 'sentryvision'),
        user=os.environ.get('POSTGRES_USER', 'sentryvision'),
        password=os.environ.get('POSTGRES_PASSWORD'),
    )
    cur = conn.cursor()
    cur.execute("DELETE FROM face_clusters WHERE name IS NULL OR name = ''")

    n_saved = 0
    for ci, idxs in enumerate(clusters):
        if len(idxs) < 2:
            continue
        person_id = f'person_{ci + 1:03d}'
        rep_idx = max(idxs, key=lambda i: face_metadata[i]['bbox'][2] * face_metadata[i]['bbox'][3])
        rep = face_metadata[rep_idx]

        crop_path = None
        try:
            image = cv2.imread(rep['path'])
            if image is not None:
                ih, iw = image.shape[:2]
                x, y, w, h = rep['bbox']
                x = max(0, min(int(x), iw - 1))
                y = max(0, min(int(y), ih - 1))
                w = max(8, min(int(w), iw - x))
                h = max(8, min(int(h), ih - y))
                roi = image[y:y + h, x:x + w]
                if roi.size > 0:
                    # Upscale tiny crops so the People page shows a visible face
                    if roi.shape[0] < 160:
                        ratio = 160 / roi.shape[0]
                        roi = cv2.resize(roi, (max(160, int(roi.shape[1] * ratio)), 160), interpolation=cv2.INTER_CUBIC)
                    crop_path = os.path.join(FACE_CROPS_DIR, f'{person_id}_rep.jpg')
                    cv2.imwrite(crop_path, roi, [cv2.IMWRITE_JPEG_QUALITY, 90])
                    print(f'  Saved {person_id}: {roi.shape[1]}x{roi.shape[0]} from {rep["image"][:40]}...', flush=True)
        except Exception as e:
            print(f'    crop save failed {person_id}: {e}')

        avg = np.mean([face_crops[i] for i in idxs], axis=0)
        cur.execute(
            """INSERT INTO face_clusters (cluster_id, name, image_path, embedding_quality, face_count, description, embedding_avg_512)
               VALUES (%s, NULL, %s, NULL, %s, %s, %s) ON CONFLICT DO NOTHING""",
            (person_id, crop_path, len(idxs),
             f'{len(idxs)} appearances (validated sample)',
             avg.tolist()))
        n_saved += 1

    conn.commit()
    cur.close()
    conn.close()
    return n_saved


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=DEFAULT_LIMIT)
    ap.add_argument('--threshold', type=float, default=DEFAULT_THRESHOLD)
    ap.add_argument('--dry-run', action='store_true',
                    help='cluster and report without writing to DB')
    args = ap.parse_args()

    t0 = time.time()
    print(f'=== Sample Validation: {args.limit} person events, threshold={args.threshold} ===')

    print('\n1. Querying DB for test images...')
    images = get_test_images(args.limit)
    print(f'  Got {len(images)} event images')

    print('\n2. Extracting face embeddings...')
    crops, meta = extract_embeddings(images)

    print(f'\n3. Clustering {len(crops)} faces...')
    clusters = cluster_faces(crops, args.threshold)
    multi = [c for c in clusters if len(c) > 1]
    single = [c for c in clusters if len(c) == 1]

    print(f'\n=== Results ===')
    print(f'  Total faces: {len(crops)}')
    print(f'  Unique persons: {len(clusters)}')
    print(f'  Multi-appearance: {len(multi)} (these would show on People page)')
    print(f'  Singletons (noise): {len(single)}')
    print(f'  Largest clusters: {sorted([len(c) for c in clusters], reverse=True)[:5]}')
    for c in sorted(multi, key=len, reverse=True)[:5]:
        print(f'    {[meta[i]["image"][:40] for i in c[:3]]} ... ({len(c)} total)')

    print(f'\n  Elapsed: {time.time() - t0:.0f}s')

    if args.dry_run:
        print('\n  Dry run — nothing written to DB')
        return

    print('\n4. Saving multi-appearance clusters to DB...')
    n = save_clusters_to_db(clusters, meta, crops)
    print(f'  Saved {n} clusters — reload /security People page to inspect')


if __name__ == '__main__':
    main()
