import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect(dbname='sentryvision', user='sentryvision', password='sentryvision123', host='postgres', port='5432')
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("""
SELECT COUNT(*) as total, 
    COUNT(*) FILTER (WHERE face_detections::text != '[]' AND face_detections IS NOT NULL) as with_faces,
    COUNT(*) FILTER (WHERE faces_detected > 0) as faces_detected_count
    FROM events WHERE timestamp > NOW() - INTERVAL '7 days'
""")
r = cur.fetchone()
print(f"Total: {r['total']}, with face_detections data: {r['with_faces']}, faces_detected>0: {r['faces_detected_count']}")

# Check persons with bbox from object_detections (person class has head bbox)
cur.execute("""
SELECT id, object_detections, file_path FROM events 
WHERE timestamp > NOW() - INTERVAL '7 days'
AND object_detections::text LIKE '%person%'
LIMIT 2
""")
for r in cur.fetchall():
    print('ID:', r['id'])
    print('  file_path:', r['file_path'])
    print('  detections:', str(r['object_detections'])[:200])
conn.close()
