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
AND object_detections IS NOT NULL
LIMIT 3
''')
rows = cur.fetchall()
for row in rows:
    print('ID:', row['id'])
    print('  file_path:', row['file_path'])
    print('  timestamp:', row['timestamp'])
    dets = row['object_detections']
    if isinstance(dets, str):
        dets = json.loads(dets)
    print('  detections:', json.dumps(dets, indent=2)[:600])
    print()

cur.execute('''
SELECT id, file_path FROM events
WHERE timestamp > NOW() - INTERVAL '7 days'
AND object_detections IS NOT NULL
''')
all_rows = cur.fetchall()
missing = 0
found = 0
sample_missing = []
for r in all_rows:
    p = r['file_path']
    if p and os.path.exists(p):
        found += 1
    else:
        missing += 1
        if len(sample_missing) < 3:
            sample_missing.append(p)
print(f'Images found on disk: {found}')
print(f'Images MISSING: {missing}')
print('Sample missing paths:', sample_missing)

conn.close()
