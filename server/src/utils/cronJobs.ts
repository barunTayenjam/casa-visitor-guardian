import { logger } from './logger.js';
import cron from 'node-cron';
import { Server as SocketIOServer } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getDetectionsPath, getEventPath, getArchivePath } from '../config/index.js';
import { serviceRegistry } from '../services/serviceRegistry.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Interface for motion events
interface MotionEvent {
  id: string;
  cameraId: string;
  timestamp: string;
  imagePath: string;
  confidence: number;
  duration: number;
}

// Generate daily report with visitor statistics and snapshots
async function generateDailyReport(io: SocketIOServer) {
  // Daily report log disabled - console.log('Generating daily report...');
  
  try {
    // Get the stream manager from the service registry
    const streamManager = serviceRegistry.getStreamManager();
    
    // Get all motion events from in-memory storage
    // In a real implementation, these would be stored in a database
    const recentEvents: MotionEvent[] = [];
    io.emit('getRecentEvents', {}, (events: MotionEvent[]) => {
      recentEvents.push(...events);
    });
    
    // Get events from the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const eventsLast24Hours = recentEvents.filter(event => 
      new Date(event.timestamp) > yesterday
    );
    
    // Group events by camera
    const eventsByCamera = eventsLast24Hours.reduce((acc, event) => {
      if (!acc[event.cameraId]) {
        acc[event.cameraId] = [];
      }
      acc[event.cameraId].push(event);
      return acc;
    }, {} as Record<string, MotionEvent[]>);
    
    // Generate statistics
    const totalEvents = eventsLast24Hours.length;
    const cameraStats = Object.entries(eventsByCamera).map(([cameraId, events]) => ({
      cameraId,
      eventCount: events.length,
      firstEvent: events[events.length - 1]?.timestamp,
      lastEvent: events[0]?.timestamp
    }));
    
    // Get camera names
    const cameras = streamManager.getAllCameras();
    const cameraNames = cameras.reduce((acc: Record<string, string>, cam: { id: string; name: string }) => {
      acc[cam.id] = cam.name;
      return acc;
    }, {} as Record<string, string>);
    
    // In a real implementation, this would generate an email report
    // For this simplified version, we'll just emit an event with the report data
    const reportData = {
      date: new Date().toLocaleDateString(),
      totalEvents,
      cameraStats,
      eventsByCamera: Object.entries(eventsByCamera).map(([cameraId, events]) => ({
        cameraId,
        cameraName: cameraNames[cameraId] || cameraId,
        events: events.slice(0, 5).map(event => ({
          id: event.id,
          timestamp: event.timestamp,
          imagePath: event.imagePath,
          confidence: event.confidence
        }))
      }))
    };
    
    // Emit the report to connected clients
    io.emit('dailyReport', { success: true, report: reportData });
    
    // Daily report success log disabled - console.log('Daily report generated successfully');
    return {
      success: true,
      report: reportData
    };
  } catch (error) {
    // Daily report error log disabled - console.error('Error generating daily report:', error);
    return {
      success: false,
      error: 'Failed to generate daily report'
    };
  }
}

// Start scheduled tasks
export function startCronJobs(io: SocketIOServer) {
  // Schedule daily report at 8:00 AM every day
  cron.schedule('0 8 * * *', async () => {
    // Cron job log disabled - console.log('Running daily report job');
    await generateDailyReport(io);
  });

  // Schedule cleanup of old snapshots and events (keep last 30 days)
  cron.schedule('0 3 * * *', () => {
    // Cleanup job log disabled - console.log('Running cleanup job');
    cleanupOldFiles();
  });

  // Schedule periodic camera health check
  cron.schedule('*/30 * * * *', () => { // Every 30 minutes
    // Health check log disabled - console.log('Running camera health check');
    checkCameraHealth(io);
  });

  // Scheduled tasks log disabled - console.log('Scheduled tasks started');
}

// Clean up old snapshots and event images using database
async function cleanupOldFiles() {
  try {
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    const now = Date.now();

    // Import database dynamically
    const { getBatchProcessingDatabase } = await import('../services/batchProcessingDatabasePostgres.js');
    const db = await getBatchProcessingDatabase();

    if (!db) {
       logger.warn('Database not available for cleanup', 'Cron');
      return;
    }

    // Mark files as archived in database
    await (db as any).dataSource.query(
      `UPDATE detection_files
       SET is_archived = true
       WHERE created_at < NOW() - INTERVAL '30 days'
         AND is_archived = false
         AND is_deleted = false`
    );

    // Get archived files for filesystem cleanup
    const archivedFiles = await (db as any).dataSource.query(
      `SELECT file_uuid, storage_path, created_at
       FROM events
       WHERE is_archived = true
         AND is_deleted = false
       LIMIT 10000`
    );

    // Move files to archive
    for (const file of archivedFiles) {
      try {
        const createdDate = new Date(file.created_at);
        const archivePath = getArchivePath(createdDate);

        // Create archive directory if needed
        await fs.promises.mkdir(path.dirname(archivePath), { recursive: true });

        // Move file to archive
        await fs.promises.rename(file.storage_path, archivePath);

        // Update storage_path in database
        await (db as any).dataSource.query(
          `UPDATE detection_files
           SET storage_path = $1
           WHERE file_uuid = $2`,
          [archivePath, file.file_uuid]
        );
      } catch (err) {
         logger.error(`Error archiving file ${file.file_uuid}`, 'Cron', err);
      }
    }

    // Cleanup completion log disabled
     logger.info(`Archived ${archivedFiles.length} files`, 'Cron');
  } catch (error) {
    // Cleanup error log disabled
     logger.error('Error cleaning up old files', 'Cron', error);
  }
}

// Check camera health and restart if needed
function checkCameraHealth(io: SocketIOServer) {
  try {
    const streamManager = serviceRegistry.getStreamManager();
    
    const cameras = streamManager.getAllCameras();
    // Camera health check log disabled - console.log(`Checking health of ${cameras.length} cameras`);
    
    // Check each camera
    cameras.forEach((camera: { id: string; name: string; isActive: boolean }) => {
      // Camera status log disabled - console.log(`Camera health check: Camera ${camera.id} is active: ${camera.isActive}`); // Added logging
      if (camera.isActive) {
        // Camera active log disabled - console.log(`Camera ${camera.id} (${camera.name}) is active`);
      } else {
        // Camera inactive log disabled - console.log(`Camera ${camera.id} (${camera.name}) is inactive, attempting to start test stream`);
        streamManager.startStream(camera.id, 'detect');
      }
    });
    
    // Emit system status update
    io.emit('systemStatus', {
      status: 'healthy',
      uptime: process.uptime(),
      totalCameras: cameras.length,
      activeCameras: cameras.filter((c: { isActive: boolean }) => c.isActive).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Health check error log disabled - console.error('Error checking camera health:', error);
  }
}
