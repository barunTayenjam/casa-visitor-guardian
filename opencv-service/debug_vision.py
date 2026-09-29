#!/usr/bin/env python3
"""Save intermediate artifacts: person crops + detected face crops.

Writes to /app/data/debug_vision/ so we can SEE what the pipeline sees
before declaring success.
"""

import os
import sys

import cv2
import numpy as np
import psycopg2

sys.path.insert(0, '/app')
from arcface_recognizer import arcface_recognizer

OUT_DIR = '/app/data/debug_vision'
os.makedirs(OUT_DIR, exist_ok=True)

pw = os.environ.get('POSTGRES_PASSWORD', '')
conn = psycopg2.connect(host='postgres', database='sentryvision',
                        user='sentryvision', password=pw)
cur = conn.cursor()
cur.execute('''SELECT file_path, timestamp, object_detections FROM events
    WHERE object_detections::text LIKE '%%person%%' AND file_path IS NOT NULL
    ORDER BY timestamp DESC LIMIT 10''')
rows = cur.fetchall()
conn.close()

idx = 0
for path, ts, dets in rows:
    img = cv2.imread(path)
    if img is None:
        continue
    h, w = img.shape[:2]
    for det in (dets or []):
        if not isinstance(det, dict) or det.get('class') != 'person':
            continue
        bb = det.get('bbox', {})
        px, py, pw, ph = (int(bb.get('x', 0)), int(bb.get('y', 0)),
                          int(bb.get('width', 0)), int(bb.get('height', 0)))
        x0, y0 = max(0, px), max(0, py)
        x1, y1 = min(w, px + pw), min(h, py + ph)
        if x1 - x0 < 30 or y1 - y0 < 30:
            continue

        person_roi = img[y0:y1, x0:x1]
        # Save the person crop as the pipeline sees it
        cv2.imwrite(os.path.join(OUT_DIR, f'{idx:02d}_person.jpg'), person_roi)

        # Upscale + detect (same as pipeline)
        scale = max(160 / person_roi.shape[0], 160 / person_roi.shape[1])
        roi = cv2.resize(person_roi, None, fx=scale, fy=scale,
                         interpolation=cv2.INTER_CUBIC)
        rgb = cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)
        rf_dets = arcface_recognizer._app.get(rgb)

        print(f'{idx:02d}: person {x1-x0}x{y1-y0} → RF detections: {len(rf_dets)}')
        for fi, d in enumerate(rf_dets):
            bx = (d.bbox / scale).astype(int)  # back to person-coord space
            fx0, fy0, fx1, fy1 = max(0, bx[0]), max(0, bx[1]), bx[2], bx[3]
            face = person_roi[fy0:fy1, fx0:fx1]
            if face.size > 0:
                cv2.imwrite(os.path.join(OUT_DIR, f'{idx:02d}_face{fi}_s{d.det_score:.2f}.jpg'), face)
                print(f'    face{fi}: score={d.det_score:.3f} size={face.shape[1]}x{face.shape[0]}')
        idx += 1

print(f'\nSaved {idx} person crops (+ faces) to {OUT_DIR}')
