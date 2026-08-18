import os
import sys
import cv2
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta

import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import HumanVerifier directly
sys.path.append('/app') # In docker
from person_verifier import HumanVerifier

# DB configuration
DB_NAME = os.getenv('DB_NAME', 'sentryvision')
DB_USER = os.getenv('DB_USER', 'sentryvision')
DB_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'postgres') # Fallback for local dev
DB_HOST = os.getenv('POSTGRES_HOST', 'postgres')
DB_PORT = os.getenv('DB_PORT', '5432')

verifier = HumanVerifier()

def connect_db():
    logger.info(f"Connecting to {DB_HOST} with user {DB_USER}")
    return psycopg2.connect(
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD, host=DB_HOST, port=DB_PORT
    )

def verify_and_prune(dry_run=True):
    print(f"Running in {'DRY RUN' if dry_run else 'WRITE'} mode...")
    try:
        conn = connect_db()
    except Exception as e:
        print(f"DB Connection Error: {e}")
        return

    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    days = int(os.getenv('DAYS_BACK', 10))
    cutoff = datetime.now() - timedelta(days=days)
    print(f"Querying events since {cutoff} ({days} days back)...")
    
    cur.execute("""
        SELECT id, file_path, object_detections, timestamp
        FROM events 
        WHERE timestamp > %s 
        AND object_detections IS NOT NULL
        AND jsonb_array_length(object_detections::jsonb) > 0
    """, (cutoff,))
    
    events = cur.fetchall()
    print(f"Found {len(events)} events to check.")
    
    remove_count = 0
    update_count = 0
    non_person_count = 0
    non_human_verified_count = 0
    missing_image_non_human_count = 0
    verified_human_count = 0

    import time
    start_time = time.time()

    import time
    start_time = time.time()

    for i, event in enumerate(events):
        # Merge: process and log in one loop
        detections = event['object_detections']
        if isinstance(detections, str):
            detections = json.loads(detections)
        
        valid_detections = []
        img_path = event['file_path']
        filename = os.path.basename(img_path) if img_path else 'unknown'
        
        for det in detections:
            try:
                # Always remove non-person detections
                if det.get('class') != 'person':
                    non_person_count += 1
                    continue

                # FORCED VERIFICATION: All 'person' detections go through HumanVerifier
                if os.path.exists(img_path):
                    img = cv2.imread(img_path)
                    if img is not None:
                        bbox = det.get('bbox', {})
                        y, x, h, w = int(bbox.get('y', 0)), int(bbox.get('x', 0)), \
                                     int(bbox.get('height', 0)), int(bbox.get('width', 0))
                        
                        h_img, w_img = img.shape[:2]
                        y1, y2 = max(0, y), min(h_img, y + h)
                        x1, x2 = max(0, x), min(w_img, x + w)
                        
                        roi = img[y1:y2, x1:x2]
                        if roi.size > 0 and verifier.verify(roi, 0.0):
                            valid_detections.append(det)
                            verified_human_count += 1
                        else:
                            non_human_verified_count += 1
                    else:
                        missing_image_non_human_count += 1
                else:
                    missing_image_non_human_count += 1
                        
            except Exception as e:
                logger.error(f"Verify Error for event {event['id']}: {e}")
                missing_image_non_human_count += 1

        if len(valid_detections) != len(detections):
            update_count += 1
            if not dry_run:
                if valid_detections:
                    cur.execute("UPDATE events SET object_detections = %s WHERE id = %s", (json.dumps(valid_detections), event['id']))
                else:
                    cur.execute("DELETE FROM events WHERE id = %s", (event['id'],))
                conn.commit()

        if (i + 1) % 500 == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed
            eta_min = (len(events) - i - 1) / rate / 60 if rate > 0 else 0
            logger.info(
                f"Progress: {i+1}/{len(events)} | humans={verified_human_count} "
                f"removed_nonperson={non_person_count} failed_verify={non_human_verified_count} "
                f"missing={missing_image_non_human_count} | {rate:.1f} ev/s | ETA {eta_min:.1f} min"
            )

    conn.close()
    total_removed = non_person_count + non_human_verified_count + missing_image_non_human_count
    print(f"{'DRY RUN' if dry_run else 'WRITE MODE'} COMPLETE")
    print(f"  Events processed:            {len(events)}")
    print(f"  Humans verified & kept:      {verified_human_count}")
    print(f"  Non-person labels removed:   {non_person_count}")
    print(f"  Failed HumanVerifier:        {non_human_verified_count}")
    print(f"  Missing/error images:        {missing_image_non_human_count}")
    print(f"  TOTAL detections removed:    {total_removed}")
    print(f"  Events updated/deleted:      {update_count}")

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "dry-run"
    verify_and_prune(dry_run=(mode != "execute"))
