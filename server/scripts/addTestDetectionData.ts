import { AppDataSource } from '../src/database.js';

async function addTestDetectionData(filename?: string, count: number = 5) {
  try {
    await AppDataSource.initialize();
    console.log('[TestData] Database connected');

    let query = `
      SELECT 
        df.file_uuid,
        df.original_filename,
        df.storage_path,
        df.camera_id,
        df.capture_timestamp
      FROM detection_files df
      LEFT JOIN events e ON df.storage_path = e.file_path
      WHERE df.file_type IN ('event_motion', 'event_face')
        AND df.is_deleted = FALSE
        AND e.id IS NULL
    `;

    const params: any[] = [];

    if (filename) {
      query += ' AND df.original_filename = $1';
      params.push(filename);
    }

    query += ' ORDER BY df.capture_timestamp DESC';

    if (!filename) {
      query += ' LIMIT $2';
      params.push(count);
    }

    const events = await AppDataSource.query(query, params);
    console.log(`[TestData] Found ${events.length} events without detection data`);

    if (events.length === 0) {
      console.log('[TestData] No events to add data to.');
      process.exit(0);
    }

    let successCount = 0;

    for (const event of events) {
      // Generate mock detection data
      const mockDetections = {
        persons_detected: Math.floor(Math.random() * 2) + 1, // 1-2 persons
        faces_detected: Math.floor(Math.random() * 2), // 0-1 faces
        known_faces_count: Math.floor(Math.random() * 2),
        unknown_faces_count: 0,
        object_detections: Array.from({ length: Math.floor(Math.random() * 2) + 1 }, (_, i) => ({
          class: 'person',
          confidence: Number((0.80 + Math.random() * 0.19).toFixed(2)),
          bbox: {
            x: Math.floor(Math.random() * 500) + 50,
            y: Math.floor(Math.random() * 300) + 50,
            width: Math.floor(Math.random() * 80) + 40,
            height: Math.floor(Math.random() * 150) + 80
          }
        })),
        face_detections: Math.random() > 0.4 ? [{
          id: `face-${event.file_uuid}-${Date.now()}`,
          name: Math.random() > 0.5 ? 'John Doe' : 'Jane Smith',
          isKnown: true,
          confidence: Number((0.88 + Math.random() * 0.11).toFixed(2)),
          bbox: {
            x: Math.floor(Math.random() * 400) + 100,
            y: Math.floor(Math.random() * 200) + 100,
            width: 60 + Math.floor(Math.random() * 30),
            height: 80 + Math.floor(Math.random() * 40)
          }
        }] : []
      };

      // Insert into events table
      const insertEventQuery = `
        INSERT INTO events (
          event_type,
          file_path,
          camera_id,
          timestamp,
          confidence,
          metadata,
          persons_detected,
          faces_detected,
          known_faces_count,
          unknown_faces_count,
          object_detections,
          face_detections,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (file_path) DO UPDATE SET
          persons_detected = EXCLUDED.persons_detected,
          faces_detected = EXCLUDED.faces_detected,
          known_faces_count = EXCLUDED.known_faces_count,
          unknown_faces_count = EXCLUDED.unknown_faces_count,
          object_detections = EXCLUDED.object_detections,
          face_detections = EXCLUDED.face_detections,
          confidence = EXCLUDED.confidence
        RETURNING id
      `;

      try {
        const inserted = await AppDataSource.query(insertEventQuery, [
          'motion',
          event.storage_path,
          event.camera_id,
          event.capture_timestamp,
          0.85,
          JSON.stringify({ test: true }),
          mockDetections.persons_detected,
          mockDetections.faces_detected,
          mockDetections.known_faces_count,
          mockDetections.unknown_faces_count,
          JSON.stringify(mockDetections.object_detections),
          JSON.stringify(mockDetections.face_detections),
          new Date()
        ]);

        console.log(`[TestData] ✓ Added detection data to: ${event.original_filename}`);
        console.log(`  - ${mockDetections.persons_detected} persons, ${mockDetections.faces_detected} faces`);
        successCount++;
      } catch (error) {
        console.error(`[TestData] ✗ Failed for ${event.original_filename}:`, error);
      }
    }

    console.log(`\n[TestData] Success: ${successCount}/${events.length} events updated`);
    console.log('[TestData] Detection details are now visible in the Detection Gallery!');
    process.exit(0);
  } catch (error) {
    console.error('[TestData] Error:', error);
    process.exit(1);
  }
}

const filenameArg = process.argv[2];
const countArg = parseInt(process.argv[3]) || 5;

addTestDetectionData(filenameArg, countArg);
