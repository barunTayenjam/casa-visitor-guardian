// Server startup
import express from 'express';
import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import configuration
import { config } from './config/index.js';

import { configureRoutes } from './routes/index.js';
import { configureAuthRoutes } from './routes/auth.js';
import { configureVisitorRoutes } from './routes/visitorRoutes.js';
import { setupRTSPStreams } from './streams/rtspManager.js';
import { initializeDatabase, AppDataSource } from './database.js';
import { setupOptimizedMotionDetection, cleanupOptimizedMotionDetection } from './detection/optimizedMotionDetection.js';
import { consolidatedDetectionService } from './detection/consolidatedDetectionService.js';
import { ReviewService } from './services/review/reviewService.js';
import { TimelineService } from './services/timeline/timelineService.js';
import { DetectionService } from './services/detection/detectionService.js';
import { ReviewSegment } from './models/ReviewSegment.js';
import { UserReviewStatus } from './models/UserReviewStatus.js';
import { Timeline } from './models/Timeline.js';
import { AdaptiveRegion } from './models/AdaptiveRegion.js';
import { DetectionConfig } from './models/DetectionConfig.js';
import { PreviewService } from './services/preview/previewService.js';
import { storageStatsService } from './services/storageStatsService.js';
import { retentionPolicyService } from './services/retentionPolicyService.js';
import { automatedCleanupService } from './services/automatedCleanupService.js';
import NotificationService from './services/notificationService.js';
import storageRoutes from './routes/storageRoutes.js';

dotenv.config({ path: './.env' });

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:5173', 'http://192.168.31.99:5173', 'http://192.168.31.99:8082'],
  credentials: true
}));
app.use(express.json());

// Serve events from data directory with scanning fallback
app.get('/events/:filename', async (req, res) => {
  const filename = req.params.filename;

  try {
    // First, try to query database to get storage path for this filename
    const AppDataSource = (global as any).AppDataSource;
    let results = [];

    if (AppDataSource) {
      try {
        const query = `
          SELECT storage_path
          FROM detection_files
          WHERE original_filename = $1
            AND (file_type = 'event_face' OR file_type = 'event_motion')
            AND is_deleted = FALSE
          ORDER BY created_at DESC
          LIMIT 1
        `;

        results = await AppDataSource.query(query, [filename]);
      } catch (dbError) {
        console.warn('Database query failed, falling back to file system scan:', dbError.message);
      }
    }

    if (results.length === 0) {
      // If not found in database or DB unavailable, try scanning across year-month directories
      const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - i); // Last 5 years

      for (const year of years) {
        for (let month = 12; month >= 1; month--) {
          const monthStr = month.toString().padStart(2, '0');
          const directPath = path.join(process.cwd(), 'data', 'detections', `${year}-${monthStr}`, 'events', 'motion', filename);

          if (fs.existsSync(directPath)) {
            return res.sendFile(directPath);
          }
        }
      }

      // If still not found, try direct path in current month
      const currentYear = new Date().getFullYear();
      const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const directPath = path.join(process.cwd(), 'data', 'detections', `${currentYear}-${currentMonth}`, 'events', 'motion', filename);

      if (fs.existsSync(directPath)) {
        return res.sendFile(directPath);
      }

      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    let imagePath = results[0].storage_path;

    // If the path is relative, resolve it relative to the data directory
    if (!path.isAbsolute(imagePath)) {
      imagePath = path.join(process.cwd(), 'data', 'detections', imagePath);
    }

    if (fs.existsSync(imagePath)) {
      res.sendFile(imagePath);
    } else {
      // If file doesn't exist at the stored path, try scanning fallback
      const currentYear = new Date().getFullYear();
      const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const fallbackPath = path.join(process.cwd(), 'data', 'detections', `${currentYear}-${currentMonth}`, 'events', 'motion', filename);

      if (fs.existsSync(fallbackPath)) {
        res.sendFile(fallbackPath);
      } else {
        res.status(404).json({ success: false, error: 'Image file not found at stored path' });
      }
    }
  } catch (error) {
    console.error('Error serving event image:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Serve snapshots from data directory with scanning fallback
app.get('/snapshots/:filename', async (req, res) => {
  const filename = req.params.filename;

  try {
    // First, try to query database to get storage path for this filename
    const AppDataSource = (global as any).AppDataSource;
    let results = [];

    if (AppDataSource) {
      try {
        const query = `
          SELECT storage_path
          FROM detection_files
          WHERE original_filename = $1
            AND file_type = 'snapshot'
            AND is_deleted = FALSE
          ORDER BY created_at DESC
          LIMIT 1
        `;

        results = await AppDataSource.query(query, [filename]);
      } catch (dbError) {
        console.warn('Database query failed, falling back to file system scan:', dbError.message);
      }
    }

    if (results.length === 0) {
      // If not found in database or DB unavailable, try scanning across year-month directories
      const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - i); // Last 5 years

      for (const year of years) {
        for (let month = 12; month >= 1; month--) {
          const monthStr = month.toString().padStart(2, '0');
          const directPath = path.join(process.cwd(), 'data', 'detections', `${year}-${monthStr}`, 'snapshots', filename);

          if (fs.existsSync(directPath)) {
            return res.sendFile(directPath);
          }
        }
      }

      // If still not found, try direct path in current month
      const currentYear = new Date().getFullYear();
      const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const directPath = path.join(process.cwd(), 'data', 'detections', `${currentYear}-${currentMonth}`, 'snapshots', filename);

      if (fs.existsSync(directPath)) {
        return res.sendFile(directPath);
      }

      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    let imagePath = results[0].storage_path;

    // If the path is relative, resolve it relative to the data directory
    if (!path.isAbsolute(imagePath)) {
      imagePath = path.join(process.cwd(), 'data', 'detections', imagePath);
    }

    if (fs.existsSync(imagePath)) {
      res.sendFile(imagePath);
    } else {
      // If file doesn't exist at the stored path, try scanning fallback
      const currentYear = new Date().getFullYear();
      const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const fallbackPath = path.join(process.cwd(), 'data', 'detections', `${currentYear}-${currentMonth}`, 'snapshots', filename);

      if (fs.existsSync(fallbackPath)) {
        res.sendFile(fallbackPath);
      } else {
        res.status(404).json({ success: false, error: 'Image file not found at stored path' });
      }
    }
  } catch (error) {
    console.error('Error serving snapshot image:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Serve images from detections directory (where motion events are actually stored)
app.use('/events', express.static(path.join(process.cwd(), 'data/detections'), {
  maxAge: '1d',
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.jpg') || filepath.endsWith('.jpeg') || filepath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
  }
}));

app.use('/snapshots', express.static(path.join(process.cwd(), 'public/snapshots'), {
  maxAge: '1d',
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.jpg') || filepath.endsWith('.jpeg') || filepath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
  }
}));

app.use('/public', express.static('public'));

// Serve frontend static files
const distPath = path.join(process.cwd(), 'dist'); // Use relative path for both container and local
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  console.log(`Frontend dist directory not found at ${distPath}, skipping static file serving`);
}


// Create HTTP server
const server = http.createServer(app);

// Configure Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:5173', 'http://192.168.31.99:5173', 'http://192.168.31.99:8082'],
    credentials: true
  }
});

// Basic routes - with debugging
app.get('/health', (req, res) => {
  console.log('=== HEALTH ENDPOINT START ===');
  console.log('1. Request received');
  try {
    console.log('2. About to send response');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
    console.log('3. Response sent');
  } catch (error) {
    console.error('4. Error in health endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
  console.log('=== HEALTH ENDPOINT END ===');
});

// Stream health endpoint
app.get('/api/streams/health', (req, res) => {
  try {
    const streamManager = (global as any).streamManager;
    if (!streamManager || !streamManager.healthMonitor) {
      return res.status(503).json({
        success: false,
        error: 'Stream manager not available'
      });
    }

    const healthStatus = streamManager.healthMonitor.getHealthStatus();
    const now = Date.now();

    const cameraHealth = healthStatus.map(({ key, status }) => {
      const timeSinceLastFrame = status.lastFrameTime > 0 ? now - status.lastFrameTime : null;
      const isStale = timeSinceLastFrame !== null && timeSinceLastFrame > 120000; // 2 minutes

      return {
        cameraId: status.cameraId,
        role: status.role,
        isActive: status.isActive,
        lastFrameTime: status.lastFrameTime > 0 ? new Date(status.lastFrameTime).toISOString() : null,
        secondsSinceLastFrame: timeSinceLastFrame !== null ? Math.floor(timeSinceLastFrame / 1000) : null,
        isStale,
        restartAttempts: status.restartAttempts,
        lastRestartTime: status.lastRestartTime > 0 ? new Date(status.lastRestartTime).toISOString() : null
      };
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalStreams: cameraHealth.length,
      activeStreams: cameraHealth.filter(h => h.isActive).length,
      staleStreams: cameraHealth.filter(h => h.isStale).length,
      streams: cameraHealth
    });
  } catch (error) {
    console.error('Error in stream health endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Configure routes first
configureAuthRoutes(app);
configureRoutes(app, io);
configureVisitorRoutes(app);
app.use('/api/storage', storageRoutes);

// NVIDIA AI Vision Analysis Routes
import nvidiaRoutes from './routes/nvidiaRoutes.js';
app.use('/api/nvidia', nvidiaRoutes);

// Review & Timeline Routes (no auth required for read, auth for write)
app.get('/api/review', async (req, res) => {
  try {
    const reviewService = (global as any).reviewService;
    if (!reviewService) {
      return res.json({ success: true, data: { segments: [], total: 0, hasMore: false } });
    }

    const { camera, after, before, severity, labels, limit, offset } = req.query;

    const result = await reviewService.getReviewSegments({
      camera: camera as string,
      after: after ? new Date(after as string) : undefined,
      before: before ? new Date(before as string) : undefined,
      severity: severity as 'alert' | 'detection',
      labels: labels ? (labels as string).split(',') : undefined,
      limit: limit ? parseInt(limit as string) : 100,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching review segments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch review segments' });
  }
});

app.get('/api/review/:id', async (req, res) => {
  try {
    const reviewService = (global as any).reviewService;
    if (!reviewService) {
      return res.status(404).json({ success: false, error: 'Review service not available' });
    }

    const segment = await reviewService.getReviewSegment(req.params.id);
    if (!segment) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }

    res.json({ success: true, data: segment });
  } catch (error) {
    console.error('Error fetching review segment:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch review segment' });
  }
});

app.post('/api/review/:id/acknowledge', async (req, res) => {
  try {
    const reviewService = (global as any).reviewService;
    if (!reviewService) {
      return res.status(503).json({ success: false, error: 'Review service not available' });
    }

    const { userId = 'anonymous' } = req.body;
    await reviewService.acknowledgeSegment(req.params.id, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error acknowledging segment:', error);
    res.status(500).json({ success: false, error: 'Failed to acknowledge segment' });
  }
});

app.get('/api/timeline', async (req, res) => {
  try {
    const timelineService = (global as any).timelineService;
    if (!timelineService) {
      return res.json({ success: true, data: { events: [], summary: {} } });
    }

    const { camera, after, before, sources, limit } = req.query;

    const result = await timelineService.getTimeline({
      camera: camera as string,
      after: after ? new Date(after as string) : undefined,
      before: before ? new Date(before as string) : undefined,
      sources: sources ? (sources as string).split(',') : undefined,
      limit: limit ? parseInt(limit as string) : 1000,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch timeline' });
  }
});

app.get('/api/timeline/active/:camera', async (req, res) => {
  try {
    const timelineService = (global as any).timelineService;
    if (!timelineService) {
      return res.json({ success: true, data: {} });
    }

    const activeObjects = await timelineService.getActiveObjects(req.params.camera);
    const result: Record<string, { label: string; lastSeen: string; score: number }> = {};
    for (const [id, obj] of activeObjects.entries()) {
      result[id] = { ...obj, lastSeen: obj.lastSeen.toISOString() };
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching active objects:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch active objects' });
  }
});

app.get('/api/detection/config', async (req, res) => {
  try {
    const detectionConfigService = (global as any).detectionConfigService;
    if (!detectionConfigService) {
      return res.json({
        success: true,
        data: {
          thresholds: {
            person: { min_score: 0.3, threshold: 0.5 },
            car: { min_score: 0.4, threshold: 0.6 },
            dog: { min_score: 0.3, threshold: 0.4 },
            package: { min_score: 0.25, threshold: 0.35 },
          },
          labelmap: { truck: 'car', bus: 'car', motorcycle: 'car' },
          score_history_length: 7,
        }
      });
    }

    const config = await detectionConfigService.getConfig(req.query.camera as string);
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Error fetching detection config:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch detection config' });
  }
});

app.put('/api/detection/config', async (req, res) => {
  try {
    const detectionConfigService = (global as any).detectionConfigService;
    if (!detectionConfigService) {
      return res.status(503).json({ success: false, error: 'Detection config service not available' });
    }

    const { camera, thresholds, labelmap, score_history_length } = req.body;
    await detectionConfigService.updateConfig(camera, { thresholds, labelmap, score_history_length });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating detection config:', error);
    res.status(500).json({ success: false, error: 'Failed to update detection config' });
  }
});

console.log('Routes configured successfully');

// For any other route, serve the index.html - temporarily disabled
// app.get('*', (req, res) => {
//     res.sendFile(path.join(distPath, 'index.html'));
// });

// Initialize stream manager
async function initializeServices() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
 
    // Set AppDataSource globally for other modules to access
    (global as any).AppDataSource = AppDataSource;
 
    console.log('Initializing consolidated detection service...');
    const detectionStatus = await consolidatedDetectionService.getServiceStatus();
    if (detectionStatus.available) {
      console.log(`Detection service available at ${detectionStatus.url} (${detectionStatus.responseTime}ms)`);
      (global as any).detectionService = consolidatedDetectionService;
    } else {
      console.warn('Detection service not available, using stub detection');
    }

    console.log('Initializing stream manager...');
    (global as any).streamManager = await setupRTSPStreams(io);
    console.log('Stream manager initialized successfully');

    console.log('Initializing motion detection...');
    (global as any).motionDetector = setupOptimizedMotionDetection((global as any).streamManager, io, (global as any).detectionService);
    console.log('Motion detection initialized successfully');

    console.log('Initializing review, timeline and detection services...');
    const reviewSegmentRepo = AppDataSource.getRepository(ReviewSegment);
    const reviewStatusRepo = AppDataSource.getRepository(UserReviewStatus);
    const timelineRepo = AppDataSource.getRepository(Timeline);
    const regionRepo = AppDataSource.getRepository(AdaptiveRegion);
    const detectionConfigRepo = AppDataSource.getRepository(DetectionConfig);

    const previewService = new PreviewService((global as any).streamManager);
    const timelineService = new TimelineService(timelineRepo, regionRepo);
    const detectionService = new DetectionService(detectionConfigRepo);
    const reviewService = new ReviewService(reviewSegmentRepo, reviewStatusRepo, timelineService, previewService);

    (global as any).timelineService = timelineService;
    (global as any).detectionConfigService = detectionService;
    (global as any).reviewService = reviewService;
    console.log('Review, timeline and detection services initialized successfully');

    console.log('Initializing notification service...');
    NotificationService.initialize();
    (global as any).notificationService = NotificationService;
    console.log('Notification service initialized successfully');

    console.log('Initializing storage services...');
    await storageStatsService.initialize();
    await retentionPolicyService.initialize();
    await automatedCleanupService.initialize();
    (global as any).storageStatsService = storageStatsService;
    (global as any).retentionPolicyService = retentionPolicyService;
    (global as any).automatedCleanupService = automatedCleanupService;
    console.log('Storage services initialized successfully');

  } catch (error) {
    console.error('Failed to initialize services:', error);
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // Handle stream requests
  socket.on('requestStream', (data: { cameraId: string; role?: 'detect' | 'record' | 'live' }) => {
    const { cameraId, role = 'live' } = data;
    console.log(`Stream requested for camera: ${cameraId} role: ${role} by client: ${socket.id}`);
    const streamManager = (global as any).streamManager;
    if (streamManager) {
      const success = streamManager.startStream(cameraId, role);
      // CRITICAL FIX: Always join the room, even if stream was already active
      // This ensures reconnected clients receive frames
      socket.join(`camera-${cameraId}-${role}`);
      socket.emit('streamRequested', { cameraId, role, success: true });
      console.log(`Client ${socket.id} joined room camera-${cameraId}-${role} (stream was ${success ? 'started' : 'already active'})`);
    } else {
      socket.emit('streamError', { cameraId, role, error: 'Stream manager not available' });
      console.error('Stream manager not available');
    }
  });
  
  // Handle stop stream requests
  socket.on('stopStream', (data: { cameraId: string; role?: 'detect' | 'record' | 'live' }) => {
    const { cameraId, role = 'live' } = data;
    console.log(`Stop stream requested for camera: ${cameraId} role: ${role} by client: ${socket.id}`);
    if (role !== 'live') {
      console.log(`Ignoring stopStream for ${role} role — only live can be stopped by clients`);
      return;
    }
    const streamManager = (global as any).streamManager;
    if (streamManager) {
      // Leave the camera role-specific room
      socket.leave(`camera-${cameraId}-${role}`);
      
      // Check if there are still clients in the room before stopping the stream
      const room = io.sockets.adapter.rooms.get(`camera-${cameraId}-${role}`);
      const clientsInRoom = room ? room.size : 0;
      
      console.log(`Client ${socket.id} left room camera-${cameraId}-${role}. Clients remaining: ${clientsInRoom}`);
      
      // Only stop the stream if no clients are left in the room
      if (clientsInRoom === 0) {
        const success = streamManager.stopStream(cameraId, role);
        if (success) {
          console.log(`Stream stopped for camera: ${cameraId} ${role} (no more clients)`);
        } else {
          console.error(`Failed to stop stream for camera: ${cameraId} ${role}`);
        }
      } else {
        console.log(`Stream continues for camera: ${cameraId} ${role} (${clientsInRoom} client(s) still watching)`);
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    const streamManager = (global as any).streamManager;
    if (streamManager) {
      const cameras = streamManager.getAllCameras();
      cameras.forEach((camera: any) => {
        const room = io.sockets.adapter.rooms.get(`camera-${camera.id}-live`);
        const clientsInRoom = room ? room.size : 0;
        
        if (clientsInRoom === 0) {
          if (camera.activeRoles.has('live')) {
            console.log(`Auto-stopping ${camera.id} live stream (no clients after disconnect)`);
            streamManager.stopStream(camera.id, 'live');
          }
        }
      });
    }
  });
});

// Graceful shutdown
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  const shutdownTimeout = setTimeout(() => {
    console.error('Forced shutdown after 10s timeout');
    process.exit(1);
  }, 10000);

  try {
    const streamManager = (global as any).streamManager;
    if (streamManager) {
      streamManager.shutdown();
    }

    await cleanupOptimizedMotionDetection();

    const detectionService = (global as any).detectionService;
    if (detectionService && typeof detectionService.cleanup === 'function') {
      await detectionService.cleanup();
    }

    const cleanupService = (global as any).automatedCleanupService;
    if (cleanupService && typeof cleanupService.shutdown === 'function') {
      await cleanupService.shutdown();
    }

    io.disconnectSockets(true);
    io.close();

    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('Database connection closed');
    }

    server.close(() => {
      clearTimeout(shutdownTimeout);
      console.log('Server closed');
      process.exit(0);
    });
  } catch (error) {
    clearTimeout(shutdownTimeout);
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const PORT = process.env.PORT || 8082;

server.listen(PORT, async () => {
  console.log(`SentryVision Server started on port ${PORT}`);

  await initializeServices();
});

server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`ERROR: Port ${PORT} is already in use. Kill the process or change PORT.`);
    console.error(`  Run: fuser -k ${PORT}/tcp`);
    process.exit(1);
  }
  throw error;
});