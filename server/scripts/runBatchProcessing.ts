import { AppDataSource } from '../src/database.js';
import { batchProcessingService } from '../src/services/batchProcessingService.js';
import fs from 'node:fs';
import path from 'node:path';

async function runBatchProcessingOnExistingEvents() {
  try {
    await AppDataSource.initialize();
    console.log('[BatchProcess] Database connected');

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
      LEFT JOIN processed_images pi ON df.original_filename = pi.filename
      WHERE df.file_type IN ('event_motion', 'event_face')
        AND df.is_deleted = FALSE
        AND e.id IS NULL
        AND pi.id IS NULL
      LIMIT 10
    `;

    const events = await AppDataSource.query(query);
    console.log(`[BatchProcess] Found ${events.length} events without detection data`);

    if (events.length === 0) {
      console.log('[BatchProcess] No events to process. All events have detection data.');
      process.exit(0);
    }

    // Prepare events for batch processing
    const eventsToProcess = events.map((row: any) => {
      const filePath = row.storage_path;
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.warn(`[BatchProcess] File not found: ${filePath}`);
        return null;
      }

      const stats = fs.statSync(filePath);
      
      return {
        filename: row.original_filename,
        filePath: filePath,
        timestamp: new Date(row.capture_timestamp),
        cameraId: row.camera_id,
        size: stats.size
      };
    }).filter((e): e is NonNullable<typeof e> => e !== null);

    console.log(`[BatchProcess] Processing ${eventsToProcess.length} valid events`);

    // Get time range from events
    const timestamps = eventsToProcess.map(e => e.timestamp.getTime());
    const minTime = new Date(Math.min(...timestamps));
    const maxTime = new Date(Math.max(...timestamps));

    console.log(`[BatchProcess] Time range: ${minTime.toISOString()} to ${maxTime.toISOString()}`);

    // Run batch processing
    const jobId = await batchProcessingService.startBatchProcessingWithPersistence({
      timeRange: {
        start: minTime,
        end: maxTime
      },
      detectionTypes: ['both'],
      confidenceThreshold: 0.6,
      saveResults: true,
      outputFormat: 'database'
    });

    console.log(`[BatchProcess] Created batch job: ${jobId}`);
    console.log('[BatchProcess] Starting processing...');

    // Wait a bit for processing to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('[BatchProcess] Batch processing started in background!');
    console.log(`[BatchProcess] Check job results with ID: ${jobId}`);

    process.exit(0);
  } catch (error) {
    console.error('[BatchProcess] Error:', error);
    process.exit(1);
  }
}

runBatchProcessingOnExistingEvents();
