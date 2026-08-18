import os
import sys
import json
import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect(
    dbname='sentryvision', user='sentryvision',
    password='sentryvision123', host='postgres', port='5432'
)
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute('''
SELECT id, file_path, object_detections, timestamp
FROM events
WHERE timestamp > NOW() - INTERVAL '7 days'
LIMIT 10
''')
rows = cur.fetchall()
for row in rows:
    print(f"ID: {row['id']}")
    print(f"  file_path: {row['file_path']}")
    print(f"  timestamp: {row['timestamp']}")
    dets = row['object_detections']
    if isinstance(dets, str):
        dets = json.loads(dets)
    print(f"  detections: {json.dumps(dets, indent=2)[:600]}")
    print()

conn.close()
