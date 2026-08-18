import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger.js';
import { AppDataSource } from '../database.js';
import { setCameras, loadCamerasFromFile } from '../config/cameraLoader.js';
import { config, type CameraConfig } from '../config/index.js';
import { setupRTSPStreams } from '../streams/rtspManager.js';
import { consolidatedDetectionService } from '../detection/consolidatedDetectionService.js';
import { ReviewService } from '../services/review/reviewService.js';
import { TimelineService } from '../services/timeline/timelineService.js';
import { DetectionService } from '../services/detection/detectionService.js';
import { PreviewService } from '../services/preview/previewService.js';
import { TimelapseService } from '../services/timelapse/timelapseService.js';
import { setTimelapseService } from '../routes/timelapse.js';
import { retentionPolicyService } from '../services/retentionPolicyService.js';
import { automatedCleanupService } from '../services/automatedCleanupService.js';
import NotificationService from '../services/notificationService.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { inMemoryState } from '../services/inMemoryStateService.js';
import { PythonWsClient, TrackingEvent } from '../services/pythonWsClient.js';
import { persistDetectionEvent } from '../pipeline/detectionPersistence.js';
import { ReviewSegment } from '../models/ReviewSegment.js';
import { UserReviewStatus } from '../models/UserReviewStatus.js';
import { Timeline } from '../models/Timeline.js';
import { AdaptiveRegion } from '../models/AdaptiveRegion.js';
import { DetectionConfig } from '../models/DetectionConfig.js';

export async function initializeServices(io: SocketIOServer): Promise<void> {
  serviceRegistry.setAppDataSource(AppDataSource);
  serviceRegistry.setDetectionService(consolidatedDetectionService);

  try {
    await consolidatedDetectionService.loadSettingsFromDb();
    logger.info('Detection settings loaded from database', 'INIT');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`Could not load detection settings from DB: ${msg}`, 'INIT');
  }

  try {
    await inMemoryState.loadAlertsFromDb();
    logger.info('Alerts loaded from database', 'INIT');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`Could not load alerts from DB: ${msg}`, 'INIT');
  }

  try {
    logger.info('Initializing Python WebSocket client...', 'INIT');
    const pythonWsClient = new PythonWsClient(config.pipeline.pythonWsUrl);
    pythonWsClient.connect();
    serviceRegistry.setPythonWsClient(pythonWsClient);

    const persistedTracks = new Set<string>();
    const lastSavedPerCameraClass = new Map<
      string,
      { bbox: { x: number; y: number; w: number; h: number }; ts: number }
    >();

    pythonWsClient.on('trackingEvent', (ev: TrackingEvent) => {
      const {
        cameraId,
        event: eventType,
        trackId,
        class: className,
        score,
        bbox,
        identity,
        identityConfidence,
      } = ev;
      if (!cameraId) return;

      const BROADCAST_MIN_SCORE = 0.5;
      const broadcastWorthy = (score ?? 0) >= BROADCAST_MIN_SCORE;

      if ((eventType === 'track_started' || eventType === 'track_updated') && broadcastWorthy) {
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
            faces: [
              {
                id: `track_${trackId}`,
                name: identity,
                confidence: identityConfidence ?? 0,
                bbox: detection.bbox,
              },
            ],
          });
        }

        io.to(`camera-${cameraId}-live`).emit('detection', {
          cameraId,
          detections: [detection],
          timestamp: new Date(ev.timestamp).toISOString(),
        });
      }

      const trackKey = `${cameraId}:${trackId}`;
      if (
        !persistedTracks.has(trackKey) &&
        (eventType === 'track_started' || eventType === 'track_updated')
      ) {
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
          return;
        }

        const minPersonConfidence = parseFloat(process.env.PERSON_MIN_CONFIDENCE || '0.45');
        if ((score ?? 0) < minPersonConfidence) {
          persistedTracks.add(trackKey);
          return;
        }

        persistedTracks.add(trackKey);
        persistDetectionEvent(ev).catch((err: unknown) => {
          logger.error(`Failed to persist detection event for ${cameraId}`, 'INIT', err);
        });
      }

      if (eventType === 'track_started' && broadcastWorthy) {
        io.emit('motionDetected', {
          id: `track_${trackId}_${Date.now()}`,
          cameraId,
          timestamp: new Date(ev.timestamp).toISOString(),
          confidence: Math.round(score * 100),
          labels: [className],
          detections: [
            {
              class: className,
              confidence: Math.round(score * 100),
              bbox: { x: bbox[0] ?? 0, y: bbox[1] ?? 0, width: bbox[2] ?? 0, height: bbox[3] ?? 0 },
              trackId,
            },
          ],
          trackId,
        });
      }
    });

    pythonWsClient.on('connected', () => {
      logger.info('Python WebSocket client connected', 'PythonWsClient');
      config.cameras.forEach((cam: CameraConfig) => pythonWsClient.subscribe(cam.id));
    });

    pythonWsClient.on('disconnected', () => {
      logger.warn('Disconnected from Python WebSocket server', 'PythonWsClient');
    });

    logger.info('Python WebSocket client initialized successfully', 'INIT');
  } catch (error) {
    logger.error('FATAL: Python WebSocket client initialization failed', 'INIT', error);
    process.exit(1);
  }

  let cameras: CameraConfig[] = [];

  try {
    const dbRows = await AppDataSource.query(
      'SELECT id, name, config, enabled FROM cameras ORDER BY created_at',
    );
    if (dbRows.length > 0) {
      cameras = dbRows.map((row: any) => {
        const cfg = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
        return { ...cfg, enabled: row.enabled };
      });
      logger.info(`Loaded ${cameras.length} cameras from database`, 'INIT');
    }
  } catch (error) {
    logger.warn(`Failed to load cameras from database: ${error}`, 'INIT');
  }

  if (cameras.length === 0) {
    cameras = loadCamerasFromFile();
    if (cameras.length > 0) {
      logger.info(
        `Loaded ${cameras.length} cameras from cameras.json (first-time bootstrap)`,
        'INIT',
      );
      try {
        for (const cam of cameras) {
          await AppDataSource.query(
            'INSERT INTO cameras (id, name, config, enabled) VALUES ($1, $2, $3::jsonb, $4) ON CONFLICT (id) DO UPDATE SET name = $2, config = $3::jsonb, enabled = $4',
            [cam.id, cam.name, JSON.stringify(cam), cam.enabled !== false],
          );
        }
        logger.info('Bootstrapped cameras.json cameras into database', 'INIT');
      } catch (error) {
        logger.warn(`Failed to seed cameras to database: ${error}`, 'INIT');
      }
    }
  }

  setCameras(cameras);

  try {
    logger.info('Initializing stream manager...', 'INIT');
    const streamManagerInstance = await setupRTSPStreams(io, cameras);
    serviceRegistry.setStreamManager(streamManagerInstance);
    NotificationService.loadCameraNames(streamManagerInstance);
    logger.info('Stream manager initialized successfully', 'INIT');
  } catch (error) {
    logger.error('FATAL: Stream manager initialization failed', 'INIT', error);
    process.exit(1);
  }

  try {
    logger.info('Initializing review, timeline and detection services...', 'INIT');
    const reviewSegmentRepo = AppDataSource.getRepository(ReviewSegment);
    const reviewStatusRepo = AppDataSource.getRepository(UserReviewStatus);
    const timelineRepo = AppDataSource.getRepository(Timeline);
    const regionRepo = AppDataSource.getRepository(AdaptiveRegion);

    const timelineServiceInstance = new TimelineService(timelineRepo, regionRepo);
    const previewServiceInstance = new PreviewService(timelineServiceInstance);
    const timelapseServiceInstance = new TimelapseService();
    setTimelapseService(timelapseServiceInstance);
    const detectionServiceInstance = new DetectionService();
    const reviewServiceInstance = new ReviewService(
      reviewSegmentRepo,
      reviewStatusRepo,
      timelineServiceInstance,
      previewServiceInstance,
    );

    serviceRegistry.setTimelineService(timelineServiceInstance);
    serviceRegistry.setTimelapseService(timelapseServiceInstance);
    serviceRegistry.setDetectionConfigService(detectionServiceInstance);
    serviceRegistry.setReviewService(reviewServiceInstance);
    logger.info(
      'Review, timeline, timelapse and detection services initialized successfully',
      'INIT',
    );
  } catch (error) {
    logger.error('Review/timeline/detection services failed (non-critical)', 'INIT', error);
  }

  try {
    logger.info('Initializing notification service...', 'INIT');
    await NotificationService.initialize();
    serviceRegistry.setNotificationService(NotificationService);
    logger.info('Notification service initialized successfully', 'INIT');
  } catch (error) {
    logger.error('Notification service failed (non-critical)', 'INIT', error);
  }

  try {
    logger.info('Initializing cleanup services...', 'INIT');
    await retentionPolicyService.initialize();
    await automatedCleanupService.initialize();
    serviceRegistry.setRetentionPolicyService(retentionPolicyService);
    serviceRegistry.setAutomatedCleanupService(automatedCleanupService);
    logger.info('Cleanup services initialized successfully', 'INIT');
  } catch (error) {
    logger.error('Cleanup services failed (non-critical)', 'INIT', error);
  }
}
