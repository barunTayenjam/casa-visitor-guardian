import http from 'node:http';
import path from 'node:path';
import { promises as fsp } from 'node:fs';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './utils/logger.js';
import { config, getEventPath } from './config/index.js';
import { initializeDatabase, AppDataSource } from './database.js';
import { setupRTSPStreams } from './streams/rtspManager.js';
import { consolidatedDetectionService } from './detection/consolidatedDetectionService.js';
import { ReviewService } from './services/review/reviewService.js';
import { TimelineService } from './services/timeline/timelineService.js';
import { DetectionService } from './services/detection/detectionService.js';
import { PreviewService } from './services/preview/previewService.js';
import { retentionPolicyService } from './services/retentionPolicyService.js';
import { automatedCleanupService } from './services/automatedCleanupService.js';
import NotificationService from './services/notificationService.js';
import { serviceRegistry } from './services/serviceRegistry.js';
import { startCronJobs, runStartupCleanup } from './utils/cronJobs.js';
import { inMemoryState } from './services/inMemoryStateService.js';
import { PythonWsClient, TrackingEvent } from './services/pythonWsClient.js';
import authService from './auth/index.js';
import { ReviewSegment } from './models/ReviewSegment.js';
import { UserReviewStatus } from './models/UserReviewStatus.js';
import { Timeline } from './models/Timeline.js';
import { AdaptiveRegion } from './models/AdaptiveRegion.js';
import { DetectionConfig } from './models/DetectionConfig.js';
import { Event } from './models/Event.js';

async function persistDetectionEvent(ev: TrackingEvent): Promise<void> {
  const { cameraId, event: eventType, trackId, class: className, score, bbox, identity, identityConfidence } = ev;
  if (!cameraId) return;

  const isPerson = className === 'person';
  const isFace = !!identity && identity !== 'unknown';
  const eventTypeStr = isPerson ? 'person' : isFace ? 'face' : 'motion';

  let filePath = '';
  try {
    const streamManager = serviceRegistry.getStreamManager();
    const frame = streamManager?.getLastFrame(cameraId);
    if (frame) {
      const now = new Date();
      const ts = now.toISOString().replace(/[:.]/g, '-');
      const filename = `motion_${cameraId}_${ts}.jpg`;
      const dir = getEventPath('motion', now);
      await fsp.mkdir(dir, { recursive: true });
      filePath = path.join(dir, filename);
      await fsp.writeFile(filePath, frame);
    }
  } catch (err) {
    logger.warn(`[Bootstrap] Failed to save snapshot for event on ${cameraId}`, 'BOOTSTRAP', err);
  }

  const event = new Event();
  event.event_type = eventTypeStr;
  event.camera_id = cameraId;
  event.file_path = filePath;
  event.timestamp = typeof ev.timestamp === 'number'
    ? new Date(ev.timestamp * 1000)
    : new Date(ev.timestamp);
  event.confidence = score;
  event.persons_detected = isPerson ? 1 : 0;
  event.faces_detected = isFace ? 1 : 0;
  event.known_faces_count = isFace ? 1 : 0;
  event.unknown_faces_count = 0;
  event.object_detections = [{
    class: className,
    confidence: Math.round(score * 100),
    bbox: { x: bbox[0] ?? 0, y: bbox[1] ?? 0, width: bbox[2] ?? 0, height: bbox[3] ?? 0 },
  }];
  event.face_detections = isFace ? [{
    id: `track_${trackId}`,
    name: identity ?? 'unknown',
    isKnown: identity !== null && identity !== 'unknown',
    confidence: identityConfidence ?? 0,
    bbox: { x: bbox[0] ?? 0, y: bbox[1] ?? 0, width: bbox[2] ?? 0, height: bbox[3] ?? 0 },
  }] : [];
  event.metadata = JSON.stringify({
    trackId,
    eventType,
    confidence: Math.round(score * 100),
    hasPersons: isPerson,
    hasFaces: isFace,
    personCount: isPerson ? 1 : 0,
    faceCount: isFace ? 1 : 0,
  });

  await AppDataSource.getRepository(Event).save(event);
  logger.info(`[Bootstrap] Persisted ${eventTypeStr} event for ${cameraId} (track=${trackId}, class=${className})`, 'BOOTSTRAP');

  try {
    if (eventTypeStr === 'person') {
      NotificationService.notifyObjectDetected(event, [className]).catch(() => {});
    } else if (eventTypeStr === 'face') {
      NotificationService.notifyUnknownFace(event).catch(() => {});
    } else {
      NotificationService.notifyMotionEvent(event).catch(() => {});
    }
  } catch {
    /* notification failures are non-blocking */
  }
}

export async function initializeServices(io: SocketIOServer): Promise<void> {
  try {
    await initializeDatabase();
    logger.info('Database initialized successfully', 'BOOTSTRAP');
  } catch (error) {
    logger.error('FATAL: Database initialization failed', 'BOOTSTRAP', error);
    process.exit(1);
  }

  if (config.nodeEnv === 'production') {
    const missing: string[] = [];
    if (!process.env.SEED_ADMIN_PASSWORD) missing.push('SEED_ADMIN_PASSWORD');
    if (!process.env.SEED_USER_PASSWORD) missing.push('SEED_USER_PASSWORD');
    if (missing.length > 0) {
      logger.error('FATAL: Required environment variables not set: ' + missing.join(', ') + '. Set these before starting in production.', 'BOOTSTRAP');
      process.exit(1);
    }
  }
  try {
    await authService.register({ username: 'admin', email: 'admin@security.local', password: process.env.SEED_ADMIN_PASSWORD!, role: 'admin' });
    await authService.register({ username: 'user', email: 'user@security.local', password: process.env.SEED_USER_PASSWORD!, role: 'user' });
  } catch {
    // Duplicate user errors are tolerable
  }

  serviceRegistry.setAppDataSource(AppDataSource);
  serviceRegistry.setDetectionService(consolidatedDetectionService);

  try {
    await consolidatedDetectionService.loadSettingsFromDb();
    logger.info('Detection settings loaded from database', 'BOOTSTRAP');
  } catch (error: any) {
    logger.warn(`Could not load detection settings from DB: ${error.message}`, 'BOOTSTRAP');
  }

  try {
    await inMemoryState.loadAlertsFromDb();
    logger.info('Alerts loaded from database', 'BOOTSTRAP');
  } catch (error: any) {
    logger.warn(`Could not load alerts from DB: ${error.message}`, 'BOOTSTRAP');
  }

  try {
    logger.info('Initializing Python WebSocket client...', 'BOOTSTRAP');
    const pythonWsClient = new PythonWsClient(config.pipeline.pythonWsUrl);
    pythonWsClient.connect();
    serviceRegistry.setPythonWsClient(pythonWsClient);

    const persistedTracks = new Set<string>();
    const lastSavedPerCameraClass = new Map<string, { bbox: { x: number; y: number; w: number; h: number }; ts: number }>();

    pythonWsClient.on('trackingEvent', (ev: TrackingEvent) => {
      const { cameraId, event: eventType, trackId, class: className, score, bbox, identity, identityConfidence } = ev;
      if (!cameraId) return;

      if (eventType === 'track_started' || eventType === 'track_updated') {
        const detection = {
          class: className,
          confidence: Math.round(score * 100),
          bbox: { x: bbox[0] ?? 0, y: bbox[1] ?? 0, width: bbox[2] ?? 0, height: bbox[3] ?? 0 },
          trackId,
          identity,
          identityConfidence,
        };

        if (className === 'person') {
          io.emit('personDetected', {
            cameraId,
            timestamp: new Date(ev.timestamp).toISOString(),
            persons: [detection],
            trackId,
          });
        }

        if (identity && identity !== 'unknown') {
          io.emit('faceDetected', {
            cameraId,
            timestamp: new Date(ev.timestamp).toISOString(),
            faces: [{
              id: `track_${trackId}`,
              name: identity,
              confidence: identityConfidence ?? 0,
              bbox: detection.bbox,
            }],
          });
        }

        io.to(`camera-${cameraId}-live`).emit('detection', {
          cameraId,
          detections: [detection],
          timestamp: new Date(ev.timestamp).toISOString(),
        });
      }

      const trackKey = `${cameraId}:${trackId}`;
      if (!persistedTracks.has(trackKey) && (eventType === 'track_started' || eventType === 'track_updated')) {
        const sceneKey = `${cameraId}:${className}`;
        const prev = lastSavedPerCameraClass.get(sceneKey);
        const now = Date.now();

        if (prev && className !== 'person') {
          const dx = Math.abs((bbox[0] ?? 0) - prev.bbox.x);
          const dy = Math.abs((bbox[1] ?? 0) - prev.bbox.y);
          const dw = Math.abs((bbox[2] ?? 0) - prev.bbox.w);
          const dh = Math.abs((bbox[3] ?? 0) - prev.bbox.h);
          const bboxShift = Math.sqrt(dx * dx + dy * dy + dw * dw + dh * dh);
          const elapsed = now - prev.ts;

          if (bboxShift < 80 && elapsed < 10 * 60 * 1000) {
            persistedTracks.add(trackKey);
            return;
          }
        }

        if (className !== 'person') {
          lastSavedPerCameraClass.set(sceneKey, {
            bbox: { x: bbox[0] ?? 0, y: bbox[1] ?? 0, w: bbox[2] ?? 0, h: bbox[3] ?? 0 },
            ts: now,
          });
        }

        persistedTracks.add(trackKey);
        persistDetectionEvent(ev).catch((err) => {
          logger.error(`[Bootstrap] Failed to persist detection event for ${cameraId}`, 'BOOTSTRAP', err);
        });
      }

      if (eventType === 'track_started') {
        io.emit('motionDetected', {
          id: `track_${trackId}_${Date.now()}`,
          cameraId,
          timestamp: new Date(ev.timestamp).toISOString(),
          confidence: Math.round(score * 100),
          labels: [className],
          detections: [{
            class: className,
            confidence: Math.round(score * 100),
            bbox: { x: bbox[0] ?? 0, y: bbox[1] ?? 0, width: bbox[2] ?? 0, height: bbox[3] ?? 0 },
            trackId,
          }],
          trackId,
        });
      }
    });

    pythonWsClient.on('connected', () => {
        logger.info('Python WebSocket client connected', 'PythonWsClient');
        const cameras = config.cameras.filter(c => {
          const perCamera = c.pythonEnabled;
          return perCamera === true || (perCamera === undefined && config.pipeline.mode !== 'legacy');
        });
        cameras.forEach(cam => pythonWsClient.subscribe(cam.id));
      });

    pythonWsClient.on('disconnected', () => {
      logger.warn('Disconnected from Python WebSocket server', 'PythonWsClient');
    });

    logger.info('Python WebSocket client initialized successfully', 'BOOTSTRAP');
  } catch (error) {
    logger.error('FATAL: Python WebSocket client initialization failed', 'BOOTSTRAP', error);
    process.exit(1);
  }

  try {
    logger.info('Initializing stream manager...', 'BOOTSTRAP');
    const streamManagerInstance = await setupRTSPStreams(io);
    serviceRegistry.setStreamManager(streamManagerInstance);
    NotificationService.loadCameraNames(streamManagerInstance);
    logger.info('Stream manager initialized successfully', 'BOOTSTRAP');
  } catch (error) {
    logger.error('FATAL: Stream manager initialization failed', 'BOOTSTRAP', error);
    process.exit(1);
  }

  try {
    const dbCameras = await AppDataSource.query('SELECT COUNT(*) as count FROM cameras');
    const cameraCount = parseInt(dbCameras[0]?.count || '0', 10);
    if (cameraCount === 0 && config.cameras.length === 0) {
      const seedConfig = [
        {
          id: 'cam1', name: 'Front Door', enabled: true,
          streams: [{ path: 'rtsp://admin:password@192.168.1.100:554/stream1', roles: ['live', 'detect'], width: 1920, height: 1080, fps: 2 }],
          detect: { enabled: true, type: 'opencv', interval: 3, resize_width: 640, resize_height: 360 },
          objects: { track: ['person', 'car', 'dog', 'cat', 'package'] },
          zones: [] as Array<{ id: string; name: string; coordinates: number[][]; objects: string[] }>
        },
        {
          id: 'cam2', name: 'Back Door', enabled: true,
          streams: [{ path: 'rtsp://admin:password@192.168.1.101:554/stream1', roles: ['live', 'detect'], width: 1920, height: 1080, fps: 2 }],
          detect: { enabled: true, type: 'opencv', interval: 3, resize_width: 640, resize_height: 360 },
          objects: { track: ['person', 'car', 'dog', 'cat'] },
          zones: [] as Array<{ id: string; name: string; coordinates: number[][]; objects: string[] }>
        }
      ];
      for (const cam of seedConfig) {
        await AppDataSource.query(
          'INSERT INTO cameras (id, name, config, enabled) VALUES ($1, $2, $3::jsonb, $4)',
          [cam.id, cam.name, JSON.stringify(cam), true]
        );
      }
      logger.info(`Seeded ${seedConfig.length} example cameras into database`, 'BOOTSTRAP');

      const sm = serviceRegistry.getStreamManager();
      if (sm) {
        for (const cam of seedConfig) {
          sm.addCamera(cam as any);
        }
      }
    }
  } catch (error) {
    logger.warn(`Camera DB seed skipped (non-critical): ${error}`, 'BOOTSTRAP');
  }

  try {
    logger.info('Initializing review, timeline and detection services...', 'BOOTSTRAP');
    const reviewSegmentRepo = AppDataSource.getRepository(ReviewSegment);
    const reviewStatusRepo = AppDataSource.getRepository(UserReviewStatus);
    const timelineRepo = AppDataSource.getRepository(Timeline);
    const regionRepo = AppDataSource.getRepository(AdaptiveRegion);
    const detectionConfigRepo = AppDataSource.getRepository(DetectionConfig);

    const timelineServiceInstance = new TimelineService(timelineRepo, regionRepo);
    const previewServiceInstance = new PreviewService(timelineServiceInstance);
    const detectionServiceInstance = new DetectionService();
    const reviewServiceInstance = new ReviewService(reviewSegmentRepo, reviewStatusRepo, timelineServiceInstance, previewServiceInstance);

    serviceRegistry.setTimelineService(timelineServiceInstance);
    serviceRegistry.setDetectionConfigService(detectionServiceInstance);
    serviceRegistry.setReviewService(reviewServiceInstance);
    logger.info('Review, timeline and detection services initialized successfully', 'BOOTSTRAP');
  } catch (error) {
    logger.error('Review/timeline/detection services failed (non-critical)', 'BOOTSTRAP', error);
  }

  try {
    logger.info('Initializing notification service...', 'BOOTSTRAP');
    await NotificationService.initialize();
    serviceRegistry.setNotificationService(NotificationService);
    startCronJobs(io);
    runStartupCleanup();
    logger.info('Notification service initialized successfully', 'BOOTSTRAP');
  } catch (error) {
    logger.error('Notification service failed (non-critical)', 'BOOTSTRAP', error);
  }

  try {
    logger.info('Initializing cleanup services...', 'BOOTSTRAP');
    await retentionPolicyService.initialize();
    await automatedCleanupService.initialize();
    serviceRegistry.setRetentionPolicyService(retentionPolicyService);
    serviceRegistry.setAutomatedCleanupService(automatedCleanupService);
    logger.info('Cleanup services initialized successfully', 'BOOTSTRAP');
  } catch (error) {
    logger.error('Cleanup services failed (non-critical)', 'BOOTSTRAP', error);
  }
}

let isShuttingDown = false;

export async function gracefulShutdown(
  signal: string,
  server: http.Server,
  io: SocketIOServer
): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Shutting down gracefully...`, 'BOOTSTRAP');
  const shutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown after 10s timeout', 'BOOTSTRAP');
    process.exit(1);
  }, 10000);

  try {
    const streamManager = serviceRegistry.getStreamManager();
    streamManager.shutdown();

    const detectionService = serviceRegistry.getDetectionService();
    if (typeof detectionService.cleanup === 'function') {
      await detectionService.cleanup();
    }

    const cleanupService = serviceRegistry.getAutomatedCleanupService();
    if (typeof cleanupService.shutdown === 'function') {
      await cleanupService.shutdown();
    }

    try {
      const pythonWsClient = serviceRegistry.getPythonWsClient();
      if (pythonWsClient) {
        pythonWsClient.disconnect();
        logger.info('Python WebSocket client disconnected', 'BOOTSTRAP');
      }
    } catch {
      // Service may not have been initialized
    }

    io.disconnectSockets(true);
    io.close();

    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logger.info('Database connection closed', 'BOOTSTRAP');
    }

    server.close(() => {
      clearTimeout(shutdownTimeout);
      logger.info('Server closed', 'BOOTSTRAP');
      process.exit(0);
    });
  } catch (error) {
    clearTimeout(shutdownTimeout);
    logger.error('Error during shutdown', 'BOOTSTRAP', error);
    process.exit(1);
  }
}
