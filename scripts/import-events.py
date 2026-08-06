import psycopg2
import os
import glob
from datetime import datetime

# Setup DB Connection
conn = psycopg2.connect(
    host=os.getenv('POSTGRES_HOST', 'postgres'),
    database=os.getenv('POSTGRES_DB', 'sentryvision'),
    user=os.getenv('POSTGRES_USER', 'sentryvision'),
    password=os.environ.get('POSTGRES_PASSWORD')
)
cur = conn.cursor()

# Get all files
files = glob.glob('/app/data/detections/**/*.jpg', recursive=True)
print(f"Found {len(files)} detection files to import")

rows = []
for file_path in files:
    filename = os.path.basename(file_path)
    parts = filename.replace('.jpg', '').split('_')
    if len(parts) < 3:
        continue
    camera_id = parts[1]
    ts_str = parts[2]
    try:
        timestamp = datetime.strptime(ts_str, '%Y-%m-%dT%H-%M-%S-%fZ')
    except Exception:
        timestamp = datetime.now()
    rows.append((file_path, camera_id, timestamp))

if rows:
    cur.executemany("""
        INSERT INTO events (file_path, camera_id, timestamp, event_type, confidence, persons_detected, faces_detected)
        VALUES (%s, %s, %s, 'motion', 0.8, 0, 0)
        ON CONFLICT (file_path) DO NOTHING
    """, rows)

conn.commit()
cur.close()
conn.close()
print(f"Import complete: processed {len(rows)} files")