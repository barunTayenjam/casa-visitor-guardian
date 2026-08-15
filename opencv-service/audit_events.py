#!/usr/bin/env python3
"""Read-only audit: re-verify recent person events with HumanVerifier.

Reports false-positive rate WITHOUT deleting anything.
"""
import os
import psycopg2
import cv2
from person_verifier import HumanVerifier

conn = psycopg2.connect(
    dbname="sentryvision", user="sentryvision",
    password="sentryvision123", host="postgres", port=5432,
)
cur = conn.cursor()
cur.execute(
    """SELECT id, event_type, file_path, created_at
       FROM events
       WHERE event_type = 'person'
       ORDER BY created_at DESC LIMIT 50"""
)
events = cur.fetchall()

verifier = HumanVerifier()
results = {"kept": [], "false_positive": [], "missing_file": []}

for eid, etype, fpath, created in events:
    if not fpath or not os.path.exists(fpath):
        results["missing_file"].append((str(eid), fpath))
        continue
    img = cv2.imread(fpath)
    if img is None:
        results["missing_file"].append((str(eid), fpath))
        continue
    # Force full verification: low score bypasses Tier-1 YOLO trust
    human = verifier.verify(img, yolo_score=0.1)
    key = "kept" if human else "false_positive"
    results[key].append((str(eid), str(created)))

total = len(results["kept"]) + len(results["false_positive"])
print(f"Audited: {len(events)} person events ({len(results['missing_file'])} missing files)")
print(f"Verified human:  {len(results['kept'])}")
print(f"False positives: {len(results['false_positive'])}")
if total:
    print(f"False-positive rate: {100*len(results['false_positive'])/total:.1f}%")
if results["false_positive"]:
    print("\nSuspect event IDs (NOT deleted):")
    for eid, created in results["false_positive"]:
        print(f"  {eid}  {created}")
conn.close()
