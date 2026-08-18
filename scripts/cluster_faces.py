#!/usr/bin/env python3
"""
Face Clustering Pipeline for SentryVision

1. Fetches events (person detections) from the last N days
2. Crops each person ROI, runs face detection on the crop
3. Extracts 512-dim embeddings via ArcFace
4. Clusters with DBSCAN (cosine metric)
5. Saves representative face crops + JSON report + persists clusters to DB table
"""

import os
import sys
import json
import cv2
import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
from collections import defaultdict

sys.path.append('/app')
from arcface_recognizer import ArcFaceRecognizer
from sklearn.cluster import DBSCAN

# Config
DAYS_BACK = int(os.getenv('DAYS_BACK', 7))
COSINE_EPS = float(os.getenv('COSINE_EPS', 0.62))  # cosine distance threshold (lower = stricter)
MIN_SAMPLES = int(os.getenv('MIN_SAMPLES', 1))
OUTPUT_DIR = os.getenv('OUTPUT_DIR', '/app/data/detections/face_clusters')
MIN_FACE_SIZE = 40  # px

DB_NAME = os.getenv('DB_NAME', 'sentryvision')
DB_USER = os.getenv('DB_USER', 'sentryvision')
DB_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'sentryvision123')
DB_HOST = os.getenv('POSTGRES_HOST', 'postgres')
DB_PORT = int(os.getenv('DB_PORT', '5432'))

print("[cluster] initializing ArcFace recognizer...")
recognizer = ArcFaceRecognizer()
print(f"[cluster] model loaded: {recognizer._model_loaded}, trained: {recognizer.is_trained}")


def connect_db():
    return psycopg2.connect(
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD, host=DB_HOST, port=DB_PORT
    )


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    conn = connect_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cutoff = datetime.now() - timedelta(days=DAYS_BACK)
    cur.execute("""
        SELECT id, file_path, timestamp, object_detections
        FROM events
        WHERE timestamp > %s
        AND object_detections IS NOT NULL
        AND object_detections::text LIKE '%%"person"%%'
        ORDER BY timestamp DESC
    """, (cutoff,))
    events = cur.fetchall()
    print(f"[cluster] {len(events)} events with person detections in last {DAYS_BACK} days")

    faces = []  # {event_id, ts, embedding, crop}

    for idx, event in enumerate(events):
        if (idx + 1) % 200 == 0:
            print(f"[cluster]   processed {idx+1}/{len(events)} events, {len(faces)} faces so far")

        img_path = event['file_path']
        if not img_path or not os.path.exists(img_path):
            continue
        img = cv2.imread(img_path)
        if img is None:
            continue

        dets = event['object_detections']
        if isinstance(dets, str):
            dets = json.loads(dets)

        for det in dets:
            if det.get('class') != 'person':
                continue
            bbox = det.get('bbox', {})
            h_img, w_img = img.shape[:2]
            x1 = max(0, int(bbox.get('x', 0)))
            y1 = max(0, int(bbox.get('y', 0)))
            x2 = min(w_img, x1 + int(bbox.get('width', 0)))
            y2 = min(h_img, y1 + int(bbox.get('height', 0)))
            if x2 - x1 < MIN_FACE_SIZE or y2 - y1 < MIN_FACE_SIZE:
                continue

            person_roi = img[y1:y2, x1:x2]
            if person_roi.size == 0:
                continue

            # Force detection using retinaface (ArcFace) only
            face_boxes = recognizer.detect_faces(person_roi, method='retinaface')
            if not face_boxes:
                continue

            # Take the most confident face
            best = max(face_boxes, key=lambda f: f.get('confidence', 0))
            fx, fy, fw, fh = best['x'], best['y'], best['width'], best['height']
            ph, pw = person_roi.shape[:2]
            fx1, fy1 = max(0, fx), max(0, fy)
            fx2, fy2 = min(pw, fx + fw), min(ph, fy + fh)
            if fx2 - fx1 < MIN_FACE_SIZE or fy2 - fy1 < MIN_FACE_SIZE:
                continue

            face_crop = person_roi[fy1:fy2, fx1:fx2]
            embedding = recognizer.extract_face_embedding(face_crop)
            if embedding is None:
                continue

            faces.append({
                'event_id': str(event['id']),
                'timestamp': event['timestamp'].isoformat(),
                'embedding': embedding,
                'crop': face_crop,
            })

    print(f"[cluster] extracted {len(faces)} face embeddings")

    if len(faces) == 0:
        print("[cluster] no faces found, exiting")
        return

    # Normalize embeddings to unit length so euclidean ~ cosine
    X = np.array([f['embedding'] for f in faces], dtype=np.float32)
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    X = X / norms

    # DBSCAN: with unit vectors, euclidean distance d relates to cosine sim c: d^2 = 2(1-c)
    # eps for cosine distance 0.38 (sim 0.62) -> euclidean ~ 0.87... simpler: use cosine metric
    db = DBSCAN(eps=COSINE_EPS, min_samples=MIN_SAMPLES, metric='cosine')
    labels = db.fit_predict(X)

    clusters = defaultdict(list)
    for i, lbl in enumerate(labels):
        clusters[int(lbl)].append(i)

    # Sort: noise (-1) excluded, clusters by size desc
    real_labels = sorted([l for l in clusters if l != -1], key=lambda l: -len(clusters[l]))
    noise_count = len(clusters.get(-1, []))

    print(f"[cluster] found {len(real_labels)} clusters, {noise_count} unclustered faces")

    report = {'generated_at': datetime.now().isoformat(), 'days_back': DAYS_BACK,
              'total_faces': len(faces), 'cluster_count': len(real_labels),
              'noise_count': noise_count, 'clusters': []}

    # Persist clusters to DB (idempotent: clear previous run)
    cur.execute("DROP TABLE IF EXISTS face_clusters")
    cur.execute("""
        CREATE TABLE face_clusters (
            cluster_id TEXT,
            name TEXT DEFAULT NULL,
            event_id UUID,
            timestamp TIMESTAMPTZ,
            image_path TEXT,
            embedding_quality REAL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    for rank, lbl in enumerate(real_labels):
        indices = clusters[lbl]
        cluster_name = f"person_{rank + 1:03d}"
        cluster_dir = os.path.join(OUTPUT_DIR, cluster_name)
        os.makedirs(cluster_dir, exist_ok=True)

        # Representative: highest-resolution face crop
        rep_idx = max(indices, key=lambda i: faces[i]['crop'].shape[0] * faces[i]['crop'].shape[1])
        representative_face = faces[rep_idx]['crop']
        
        # Add padding and a border to make the face crop more visible
        padding = 10
        bordered_face = cv2.copyMakeBorder(representative_face, padding, padding, padding, padding, cv2.BORDER_CONSTANT, value=[40, 40, 40]) # Dark gray border
        
        rep_path = os.path.join(cluster_dir, 'representative.jpg')
        cv2.imwrite(rep_path, bordered_face)

        event_ids = []
        for i in indices:
            f = faces[i]
            event_ids.append(f['event_id'])
            # Save up to 5 samples per cluster
            if i != rep_idx and indices.index(i) < 5:
                sample_path = os.path.join(cluster_dir, f"sample_{i}.jpg")
                cv2.imwrite(sample_path, f['crop'])
            cur.execute(
                "INSERT INTO face_clusters (cluster_id, event_id, timestamp, image_path, embedding_quality) VALUES (%s,%s,%s,%s,%s)",
                (cluster_name, f['event_id'], f['timestamp'], rep_path, float(np.linalg.norm(faces[i]['embedding'])))
            )

        report['clusters'].append({
            'cluster_id': cluster_name,
            'face_count': len(indices),
            'representative_image': rep_path,
            'first_seen': faces[indices[-1]]['timestamp'],
            'last_seen': faces[indices[0]]['timestamp'],
            'event_ids': event_ids[:50],
        })
        print(f"[cluster] {cluster_name}: {len(indices)} faces, rep -> {rep_path}")

    conn.commit()
    conn.close()

    report_path = os.path.join(OUTPUT_DIR, 'clusters_report.json')
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2, default=str)

    print(f"[cluster] report saved: {report_path}")
    print(f"[cluster] DONE: {len(real_labels)} unique persons clustered from {len(faces)} faces")


if __name__ == '__main__':
    main()
