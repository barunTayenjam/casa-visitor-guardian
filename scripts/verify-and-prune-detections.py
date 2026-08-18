import os
import sys
import cv2
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta

# Mock state if needed, or import necessary modules directly from opencv-service
sys.path.append('/home/barun/Documents/sentryvision/opencv-service')
from person_verifier import HumanVerifier

# DB configuration
DB_NAME = os.getenv('DB_NAME', 'sentryvision')
DB_USER = os.getenv('DB_USER', 'sentryvision')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')

verifier = HumanVerifier()

def connect_db():
    return psycopg2.connect(
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD, host=DB_HOST, port=DB_PORT
    )

def verify_detections(dry_run=True):
    conn = connect_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 10 days ago
    cutoff = datetime.now() - timedelta(days=10)
    
    cur.execute("""
        SELECT id, file_path, object_detections 
        FROM events 
        WHERE timestamp > %s 
        AND object_detections IS NOT NULL
    """, (cutoff,))
    
    events = cur.fetchall()
    to_remove_count = 0
    
    print(f"Checking {len(events)} events for non-human detections...")
    
    for event in events:
        detections = event['object_detections']
        if isinstance(detections, str):
            detections = json.loads(detections)
            
        # Keep only human-verified detections
        valid_detections = []
        changed = False
        
        for det in detections:
            if det.get('class') == 'person':
                # Load image to verify with HumanVerifier
                img_path = event['file_path']
                # Correcting path for docker/local file mapping if needed
                if not os.path.exists(img_path):
                    # Try adjusting path to the local detection dir
                    base_name = os.path.basename(img_path)
                    img_path = os.path.join('/home/barun/Documents/sentryvision/data/detections', base_name)
                
                img = cv2.imread(img_path) if os.path.exists(img_path) else None
                
                if img is not None:
                    # ROI from bbox
                    bbox = det.get('bbox', {})
                    roi = img[bbox['y']:bbox['y']+bbox['height'], bbox['x']:bbox['x']+bbox['width']]
                    
                    if verifier.verify(roi, det.get('confidence', 0)):
                        valid_detections.append(det)
                    else:
                        changed = True
                        to_remove_count += 1
                else:
                    # Can't verify, keep it or remove? Keeping for now to be safe.
                    valid_detections.append(det)
            else:
                # Remove non-person detections
                changed = True
                to_remove_count += 1
        
        if changed and not dry_run:
            cur.execute("""
                UPDATE events SET object_detections = %s WHERE id = %s
            """, (json.dumps(valid_detections), event['id']))
            conn.commit()

    conn.close()
    print(f"Summary: {to_remove_count} non-human/unverified detections found {'would be removed' if dry_run else 'removed'}.")

if __name__ == "__main__":
    verify_detections(dry_run=True)
