import { AppDataSource } from '../src/database.js';
import fs from 'node:fs';
import path from 'node:path';

interface DetectionData {
  persons: Array<{
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
  faces: Array<{
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
    id?: string;
    name?: string;
    isKnown: boolean;
  }>;
}

async function detectFromFiles() {
  try {
    await AppDataSource.initialize();
    console.log('[RealDetection] Database connected');

    // Get all event files without detection data
    const query = `
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
      ORDER BY df.capture_timestamp DESC
      LIMIT 20
    `;

    const events = await AppDataSource.query(query);
    console.log(`[RealDetection] Found ${events.length} events without detection data`);

    if (events.length === 0) {
      console.log('[RealDetection] All events already have detection data!');
      process.exit(0);
    }

    const opencvUrl = process.env.OPENCV_SERVICE_URL || 'http://localhost:8084';

    let successCount = 0;
    let failedCount = 0;

    for (const event of events) {
      const filePath = event.storage_path;
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.warn(`[RealDetection] ✗ File not found: ${event.original_filename}`);
        failedCount++;
        continue;
      }

      try {
        // Read image file
        const imageBuffer = fs.readFileSync(filePath);
        
        // Generate file hash
        const crypto = await import('node:crypto');
        const fileHash = crypto.createHash('md5').update(imageBuffer).digest('hex');
        const fileModified = new Date().toISOString();

        console.log(`[RealDetection] Processing: ${event.original_filename}`);

        // Run object detection via OpenCV service
        const objectFormData = new FormData();
        const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
        objectFormData.append('image', blob, 'image.jpg');
        objectFormData.append('fileHash', fileHash);
        objectFormData.append('fileSize', imageBuffer.length.toString());
        objectFormData.append('fileModified', fileModified);

        const objectResponse = await fetch(`${opencvUrl}/detect-objects`, {
          method: 'POST',
          body: objectFormData
        });

        if (!objectResponse.ok) {
          console.warn(`[RealDetection] ✗ Object detection failed for ${event.original_filename}: ${objectResponse.status}`);
          failedCount++;
          continue;
        }

        const objectData: any = await objectResponse.json();
        const detections = objectData.detections || [];

        // Run face recognition via OpenCV service
        const faceFormData = new FormData();
        faceFormData.append('image', blob, 'image.jpg');
        faceFormData.append('fileHash', fileHash);
        faceFormData.append('fileSize', imageBuffer.length.toString());
        faceFormData.append('fileModified', fileModified);

        const faceResponse = await fetch(`${opencvUrl}/recognize-faces`, {
          method: 'POST',
          body: faceFormData
        });

        if (!faceResponse.ok) {
          console.warn(`[RealDetection] ✗ Face detection failed for ${event.original_filename}: ${faceResponse.status}`);
        }

        const faceData: any = faceResponse.ok ? await faceResponse.json() : { faceDetections: [] };
        const faces = faceData.faceDetections || [];

        // Count persons and faces
        const personDetections = detections.filter((d: any) => d.class === 'person');
        const knownFaces = faces.filter((f: any) => f.name && f.name !== 'Unknown');
        const unknownFaces = faces.filter((f: any) => !f.name || f.name === 'Unknown');

        // Prepare detection data
        const detectionData: DetectionData = {
          persons: personDetections.map((d: any) => ({
            confidence: d.confidence,
            bbox: d.bbox
          })),
          faces: faces.map((f: any) => ({
            confidence: f.confidence,
            bbox: f.bbox,
            id: f.id || `face-${Date.now()}-${Math.random()}`,
            name: f.name || 'Unknown',
            isKnown: f.name && f.name !== 'Unknown'
          }))
        };

        // Check if event already exists
        const checkQuery = `SELECT id FROM events WHERE file_path = $1`;
        const existingEvents = await AppDataSource.query(checkQuery, [event.storage_path]);

        if (existingEvents.length > 0) {
          // Update existing event
          const updateQuery = `UPDATE events SET persons_detected = $1, faces_detected = $2, known_faces_count = $3, unknown_faces_count = $4, object_detections = $5, face_detections = $6, confidence = $7 WHERE file_path = $8 RETURNING id`;
          await AppDataSource.query(updateQuery, [
            personDetections.length,
            faces.length,
            knownFaces.length,
            unknownFaces.length,
            JSON.stringify(detectionData.persons),
            JSON.stringify(detectionData.faces),
            Math.max(...detectionData.persons.map((p: any) => p.confidence), 0.5),
            event.storage_path
          ]);
        } else {
          // Insert new event
          const insertQuery = `INSERT INTO events (event_type, file_path, camera_id, timestamp, confidence, metadata, persons_detected, faces_detected, known_faces_count, unknown_faces_count, object_detections, face_detections, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`;
          await AppDataSource.query(insertQuery, [
            'motion',
            event.storage_path,
            event.camera_id,
            event.capture_timestamp,
            Math.max(...detectionData.persons.map((p: any) => p.confidence), 0.5),
            JSON.stringify({ source: 'real-detection', processedAt: new Date().toISOString() }),
            personDetections.length,
            faces.length,
            knownFaces.length,
            unknownFaces.length,
            JSON.stringify(detectionData.persons),
            JSON.stringify(detectionData.faces),
            new Date()
          ]);
        }

        console.log(`[RealDetection] ✓ ${event.original_filename}`);
        console.log(`  - ${personDetections.length} persons detected`);
        console.log(`  - ${faces.length} faces detected (${knownFaces.length} known, ${unknownFaces.length} unknown)`);
        successCount++;

      } catch (error) {
        console.error(`[RealDetection] ✗ Error processing ${event.original_filename}:`, error);
        failedCount++;
      }
    }

    console.log(`\n[RealDetection] Summary:`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Failed: ${failedCount}`);
    console.log(`  Total: ${events.length}`);
    console.log(`\n[RealDetection] Detection details are now visible in Detection Gallery!`);
    
    process.exit(0);
  } catch (error) {
    console.error('[RealDetection] Fatal error:', error);
    process.exit(1);
  }
}

detectFromFiles();
