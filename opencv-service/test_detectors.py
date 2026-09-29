#!/usr/bin/env python3
"""Test all available face detectors on real person crops to find the best one.

Compares: RetinaFace (insightface), mediapipe FaceMesh, uniface
on the same 20 real person-event images.
"""
import os
import sys
import cv2
import numpy as np
import psycopg2

sys.path.insert(0, '/app')

pw = os.environ.get('POSTGRES_PASSWORD', '')
conn = psycopg2.connect(host='postgres', database='sentryvision', user='sentryvision', password=pw)
cur = conn.cursor()
cur.execute('''SELECT file_path, timestamp, object_detections FROM events
    WHERE object_detections::text LIKE '%%person%%' AND file_path IS NOT NULL
    ORDER BY timestamp DESC LIMIT 20''')
rows = cur.fetchall()
conn.close()

# --- Load all detectors ---
from insightface.app import FaceAnalysis
rf_app = FaceAnalysis(name='buffalo_s', providers=['CPUExecutionProvider'])
rf_app.prepare(ctx_id=0, det_size=(640, 640))

import mediapipe as mp
mp_face = mp.solutions.face_detection.FaceDetection(
    model_selection=1,  # 1 = full range, 0 = short range
    min_detection_confidence=0.3
)

try:
    from uniface import UniFace
    uf = UniFace()
    has_uniface = True
except Exception:
    has_uniface = False

results = {'retinaface': 0, 'mediapipe': 0, 'uniface': 0, 'total_images': 0, 'total_persons': 0}

for path, ts, dets in rows:
    img = cv2.imread(path)
    if img is None:
        continue
    h, w = img.shape[:2]
    for det in (dets or []):
        if not isinstance(det, dict) or det.get('class') != 'person':
            continue
        bb = det.get('bbox', {})
        px, py, pw, ph = int(bb.get('x', 0)), int(bb.get('y', 0)), int(bb.get('width', 0)), int(bb.get('height', 0))
        x0, y0 = max(0, px), max(0, py)
        x1, y1 = min(w, px + pw), min(h, py + ph)
        if x1 - x0 < 30 or y1 - y0 < 30:
            continue

        person_roi = img[y0:y1, x0:x1]
        # Upscale to help detection
        scale = max(160 / person_roi.shape[0], 160 / person_roi.shape[1])
        roi = cv2.resize(person_roi, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        rgb = cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)
        name = path.split('/')[-1][:35]

        # Test RetinaFace
        rf_dets = rf_app.get(rgb)
        rf_faces = [d for d in rf_dets if d.det_score > 0.3]
        if rf_faces:
            results['retinaface'] += 1
            best = max(rf_faces, key=lambda d: d.det_score)
            print(f'  RetinaFace ✓ {name}: score={best.det_score:.3f} bbox={best.bbox.astype(int)}')

        # Test mediapipe
        mp_results = mp_face.process(rgb)
        if mp_results.detections:
            results['mediapipe'] += 1
            best_mp = max(mp_results.detections, key=lambda d: d.score[0])
            print(f'  MediaPipe ✓ {name}: score={best_mp.score[0]:.3f} bbox={best_mp.location_data.relative_bounding_box}')

        # Test uniface (if available)
        if has_uniface:
            try:
                faces = uf.detect(roi)
                if faces:
                    results['uniface'] += 1
                    print(f'  UniFace ✓ {name}: {len(faces)} face(s)')
            except Exception as e:
                if results.get('uniface_errors', 0) < 2:
                    print(f'  UniFace error: {e}')

        results['total_persons'] += 1
        break  # one person per image

    results['total_images'] += 1

total = results['total_persons']
print(f'\n=== Results on {total} person crops ===')
print(f'  RetinaFace: {results["retinaface"]}/{total} hits ({results["retinaface"]*100//total}%)')
print(f'  MediaPipe:  {results["mediapipe"]}/{total} hits ({results["mediapipe"]*100//total}%)')
print(f'  UniFace:    {results["uniface"]}/{total} hits ({results["uniface"]*100//total}%)')
