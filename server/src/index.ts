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
import { configureCameraRoutes } from './routes/cameraRoutes.js';
import { configureAnalyticsRoutes } from './routes/analyticsRoutes.js';
import { configureSettingsRoutes } from './routes/settingsRoutes.js';
import { configureStreamRoutes } from './routes/streamRoutes.js';
import { configureSystemRoutes } from './routes/systemRoutes.js';
import { configureReviewTimelineRoutes } from './routes/reviewTimelineRoutes.js';
import { requireUser, requireAdmin, optionalAuth } from './middleware/auth.js';
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
import { serviceRegistry } from './services/serviceRegistry.js';
import storageRoutes from './routes/storageRoutes.js';

dotenv.config({ path: './.env' });

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:5173'], // Add production origins via CORS_ORIGIN env var (comma-separated)
  credentials: true
}));
app.use(express.json());

// Serve events from data directory with scanning fallback
app.get('/events/:filename', async (req, res) => {
  const filename = req.params.filename;

  // Path traversal validation — reject suspicious filenames before any filesystem access
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ success: false, error: 'Invalid filename' });
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return res.status(400).json({ success: false, error: 'Invalid filename' });
  }

  try {
    // First, try to query database to get storage path for this filename
    const dataSource = serviceRegistry.getAppDataSource();
    let results = [];

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

        results = await dataSource.query(query, [filename]);
      } catch (dbError) {
        console.warn('Database query failed, falling back to file system scan:', dbError.message);
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

  // Path traversal validation — reject suspicious filenames before any filesystem access
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ success: false, error: 'Invalid filename' });
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return res.status(400).json({ success: false, error: 'Invalid filename' });
  }

  try {
    // First, try to query database to get storage path for this filename
    const dataSource = serviceRegistry.getAppDataSource();
    let results = [];

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

        results = await dataSource.query(query, [filename]);
      } catch (dbError) {
        console.warn('Database query failed, falling back to file system scan:', dbError.message);
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
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:5173'], // Add production origins via CORS_ORIGIN env var (comma-separated)
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
    const streamManager = serviceRegistry.getStreamManager();
    if (!streamManager.healthMonitor) {
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

// Initialize services BEFORE registering routes that depend on them
async function initializeServices() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');

    // Register AppDataSource in the service registry
    serviceRegistry.setAppDataSource(AppDataSource);

    console.log('Initializing consolidated detection service...');
    const detectionStatus = await consolidatedDetectionService.getServiceStatus();
    if (detectionStatus.available) {
      console.log(`Detection service available at ${detectionStatus.url} (${detectionStatus.responseTime}ms)`);
      serviceRegistry.setDetectionService(consolidatedDetectionService);
    } else {
      console.warn('Detection service not available, using stub detection');
    }

    console.log('Initializing stream manager...');
    const streamManagerInstance = await setupRTSPStreams(io);
    serviceRegistry.setStreamManager(streamManagerInstance);
    console.log('Stream manager initialized successfully');

    console.log('Initializing motion detection...');
    const motionDetectorInstance = setupOptimizedMotionDetection(streamManagerInstance, io, consolidatedDetectionService);
    serviceRegistry.setMotionDetector(motionDetectorInstance);
    console.log('Motion detection initialized successfully');

    console.log('Initializing review, timeline and detection services...');
    const reviewSegmentRepo = AppDataSource.getRepository(ReviewSegment);
    const reviewStatusRepo = AppDataSource.getRepository(UserReviewStatus);
    const timelineRepo = AppDataSource.getRepository(Timeline);
    const regionRepo = AppDataSource.getRepository(AdaptiveRegion);
    const detectionConfigRepo = AppDataSource.getRepository(DetectionConfig);

    const timelineServiceInstance = new TimelineService(timelineRepo, regionRepo);
    const previewServiceInstance = new PreviewService(timelineServiceInstance);
    const detectionServiceInstance = new DetectionService(detectionConfigRepo);
    const reviewServiceInstance = new ReviewService(reviewSegmentRepo, reviewStatusRepo, timelineServiceInstance, previewServiceInstance);

    serviceRegistry.setTimelineService(timelineServiceInstance);
    serviceRegistry.setDetectionConfigService(detectionServiceInstance);
    serviceRegistry.setReviewService(reviewServiceInstance);
    console.log('Review, timeline and detection services initialized successfully');

    console.log('Initializing notification service...');
    NotificationService.initialize();
    serviceRegistry.setNotificationService(NotificationService);
    console.log('Notification service initialized successfully');

    console.log('Initializing storage services...');
    await storageStatsService.initialize();
    await retentionPolicyService.initialize();
    await automatedCleanupService.initialize();
    serviceRegistry.setStorageStatsService(storageStatsService);
    serviceRegistry.setRetentionPolicyService(retentionPolicyService);
    serviceRegistry.setAutomatedCleanupService(automatedCleanupService);
    console.log('Storage services initialized successfully');

  } catch (error) {
    console.error('Failed to initialize services:', error);
  }
}

// Initialize all services before registering routes
await initializeServices();

// Configure routes (now that services are registered)
configureAuthRoutes(app);
configureRoutes(app, io);
configureVisitorRoutes(app);
app.use('/api/storage', storageRoutes);

// NVIDIA AI Vision Analysis Routes
import nvidiaRoutes from './routes/nvidiaRoutes.js';
app.use('/api/nvidia', nvidiaRoutes);

// Extracted domain-specific route modules
configureCameraRoutes(app);
configureAnalyticsRoutes(app);
configureSettingsRoutes(app);
configureStreamRoutes(app);
configureSystemRoutes(app);
configureReviewTimelineRoutes(app);

console.log('Routes configured successfully');

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // Handle stream requests
  socket.on('requestStream', (data: { cameraId: string; role?: 'detect' | 'record' | 'live' }) => {
    const { cameraId, role = 'live' } = data;
    console.log(`Stream requested for camera: ${cameraId} role: ${role} by client: ${socket.id}`);
    const streamManager = serviceRegistry.getStreamManager();
    const success = streamManager.startStream(cameraId, role);
    // CRITICAL FIX: Always join the room, even if stream was already active
    // This ensures reconnected clients receive frames
    socket.join(`camera-${cameraId}-${role}`);
    socket.emit('streamRequested', { cameraId, role, success: true });
    console.log(`Client ${socket.id} joined room camera-${cameraId}-${role} (stream was ${success ? 'started' : 'already active'})`);
  });
  
  // Handle stop stream requests
  socket.on('stopStream', (data: { cameraId: string; role?: 'detect' | 'record' | 'live' }) => {
    const { cameraId, role = 'live' } = data;
    console.log(`Stop stream requested for camera: ${cameraId} role: ${role} by client: ${socket.id}`);
    if (role !== 'live') {
      console.log(`Ignoring stopStream for ${role} role — only live can be stopped by clients`);
      return;
    }
    const streamManager = serviceRegistry.getStreamManager();
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
  });
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    const streamManager = serviceRegistry.getStreamManager();
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
    const streamManager = serviceRegistry.getStreamManager();
    streamManager.shutdown();

    await cleanupOptimizedMotionDetection();

    const detectionService = serviceRegistry.getDetectionService();
    if (typeof detectionService.cleanup === 'function') {
      await detectionService.cleanup();
    }

    const cleanupService = serviceRegistry.getAutomatedCleanupService();
    if (typeof cleanupService.shutdown === 'function') {
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
});

server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`ERROR: Port ${PORT} is already in use. Kill the process or change PORT.`);
    console.error(`  Run: fuser -k ${PORT}/tcp`);
    process.exit(1);
  }
  throw error;
});