#!/usr/bin/env python3
"""Diagnose face detection pipeline on real person events.

For each recent person event, tests Haar and RetinaFace on the head
region of the person bbox and reports per-stage results.
"""

import os
import sys

import cv2
import psycopg2

sys.path.insert(0, '/app')
from arcface_recognizer import arcface_recognizer

pw = os.environ.get('POSTGRES_PASSWORD', '')
conn = psycopg2.connect(host='postgres', database='sentryvision',
                        user='sentryvision', password=pw)
cur = conn.cursor()
cur.execute('''SELECT file_path, timestamp, object_detections FROM events
    WHERE object_detections::text LIKE '%%person%%' AND file_path IS NOT NULL
    ORDER BY timestamp DESC LIMIT 20''')
rows = cur.fetchall()
conn.close()

haar_hits = 0
rf_hits = 0
for path, ts, dets in rows:
    img = cv2.imread(path)
    if img is None:
        continue
    h, w = img.shape[:2]
    for det in (dets or []):
        if not isinstance(det, dict) or det.get('class') != 'person':
            continue
        bb = det.get('bbox', {})
        px, py, pw_, ph = (int(bb.get('x', 0)), int(bb.get('y', 0)),
                           int(bb.get('width', 0)), int(bb.get('height', 0)))
        head_roi = img[max(0, py):py + max(ph // 2, 1), max(0, px):min(w, px + pw_)]
        if head_roi.size == 0:
            continue
        hh, hw = head_roi.shape[:2]
        gray = cv2.cvtColor(head_roi, cv2.COLOR_BGR2GRAY)
        faces = arcface_recognizer.haar_detector.detectMultiScale(
            gray, 1.1, 3, minSize=(20, 20))
        person_roi = img[max(0, py):min(h, py + ph), max(0, px):min(w, px + pw_)]
        rf_dets = []
        if person_roi.size > 0:
            rgb = cv2.cvtColor(person_roi, cv2.COLOR_BGR2RGB)
            rf_dets = arcface_recognizer._app.get(rgb)
        haar_sizes = [(int(f[2]), int(f[3])) for f in faces]
        if faces:
            haar_hits += 1
        if rf_dets:
            rf_hits += 1
        name = path.split('/')[-1]
        print(f'{name}: person {pw_}x{ph} head {hw}x{hh} | Haar {len(faces)} {haar_sizes} | RF {len(rf_dets)}')
        break

print(f'\n=== Summary: {haar_hits}/20 Haar hits, {rf_hits}/20 RetinaFace hits ===')
