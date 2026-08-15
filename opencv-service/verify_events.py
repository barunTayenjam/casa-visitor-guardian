import os
import sys
import psycopg2
import cv2
from person_verifier import HumanVerifier

DB = "sentryvision"
USER = "sentryvision"
PW = "sentryvision123"
HOST = "localhost"  # inside docker it might be postgres service
PORT = 5432

try:
    conn = psycopg2.connect(dbname=DB, user=USER, password=PW, host=HOST, port=PORT)
except:
    HOST = "postgres" # in docker-compose
    conn = psycopg2.connect(dbname=DB, user=USER, password=PW, host=HOST, port=PORT)

cur = conn.cursor()
# last 100 events
cur.execute("SELECT id, event_type, file_path FROM events ORDER BY created_at DESC LIMIT 100")
events = cur.fetchall()

verifier = HumanVerifier()
kept = 0
discarded = 0

for eid, etype, fpath in events:
    if not fpath or not os.path.exists(fpath):
        continue

    img = cv2.imread(fpath)
    if img is None:
        continue

    # Force verification by passing dummy low score
    human = verifier.verify(img, yolo_score=0.1)
    if human:
        print(f"Event {eid} ({etype}): KEPT - human verified")
        kept += 1
    else:
        print(f"Event {eid} ({etype}): DISCARDED - no human")
        # Delete the event from the database
        cur.execute("DELETE FROM events WHERE id = %s", (eid,))
        discarded += 1

conn.commit()
print(f"\nSummary: Kept={kept}, Discarded={discarded}")
print(f"Deleted {discarded} events from the database.")

