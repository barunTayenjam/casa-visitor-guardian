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

for file_path in files:
    # Parse info from filename: motion_camId_timestamp.jpg
    filename = os.path.basename(file_path)
    parts = filename.replace('.jpg', '').split('_')
    if len(parts) >= 3:
        camera_id = parts[1]
        ts_str = parts[2]
        try:
            timestamp = datetime.strptime(ts_str, '%Y-%m-%dT%H-%M-%S-%fZ')
        except:
            timestamp = datetime.now()

        # Insert into events
        cur.execute("""
            INSERT INTO events (file_path, camera_id, timestamp, event_type, confidence, persons_detected, faces_detected)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, (file_path, camera_id, timestamp, 'motion', 0.8, 0, 0))

conn.commit()
cur.close()
conn.close()
print("Import complete")
