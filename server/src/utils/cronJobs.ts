import cron from 'node-cron';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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
    // Get the stream manager from global scope
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const streamManager = (global as any).streamManager;
    if (!streamManager) {
      console.error('Stream manager not found');
      return { success: false, error: 'Stream manager not found' };
    }
    
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

// Clean up old snapshots and event images
function cleanupOldFiles() {
  try {
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    const now = Date.now();
    
    // Directories to clean
    const directories = [
      path.join(__dirname, '../../public/snapshots'),
      path.join(__dirname, '../../public/events')
    ];
    
    for (const directory of directories) {
      if (!fs.existsSync(directory)) {
        continue;
      }
      
      const files = fs.readdirSync(directory);
      
      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);
        
        // Check if file is older than max age
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          // File deletion log disabled - console.log(`Deleted old file: ${filePath}`);
        }
      }
    }
    
    // Cleanup completion log disabled - console.log('Cleanup completed');
  } catch (error) {
    // Cleanup error log disabled - console.error('Error cleaning up old files:', error);
  }
}

// Check camera health and restart if needed
function checkCameraHealth(io: SocketIOServer) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const streamManager = (global as any).streamManager;
    if (!streamManager) {
      console.error('Stream manager not found');
      return;
    }
    
    const cameras = streamManager.getAllCameras();
    // Camera health check log disabled - console.log(`Checking health of ${cameras.length} cameras`);
    
    // Check each camera
    cameras.forEach((camera: { id: string; name: string; isActive: boolean }) => {
      // Camera status log disabled - console.log(`Camera health check: Camera ${camera.id} is active: ${camera.isActive}`); // Added logging
      if (camera.isActive) {
        // Camera active log disabled - console.log(`Camera ${camera.id} (${camera.name}) is active`);
      } else {
        // Camera inactive log disabled - console.log(`Camera ${camera.id} (${camera.name}) is inactive, attempting to start test stream`);
        streamManager.startStream(camera.id);
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
