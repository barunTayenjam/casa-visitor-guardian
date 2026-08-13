import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { Event } from '../models/Event.js';
import { AppDataSource } from '../database.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { getEventPath } from '../config/paths.js';
import { logger } from '../utils/logger.js';
import { TrackingEvent } from '../services/pythonWsClient.js';
import NotificationService from '../services/notificationService.js';

export async function persistDetectionEvent(ev: TrackingEvent): Promise<void> {
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
      const filename = `motion_${cameraId}_${ts}_t${trackId}.jpg`;
      const dir = getEventPath('motion', now);
      await fsp.mkdir(dir, { recursive: true });
      filePath = path.join(dir, filename);
      await fsp.writeFile(filePath, frame);
    }
  } catch (err) {
    logger.warn(`[DetectionPersistence] Failed to save snapshot for event on ${cameraId}`, 'PIPELINE', err);
  }

  const isVehicle = ['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(className);
  const severity: 'alert' | 'detection' | 'info' = isPerson ? 'alert' : isVehicle ? 'detection' : 'info';

  const event = new Event();
  event.event_type = eventTypeStr;
  event.severity = severity;
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
  logger.info(`[DetectionPersistence] Persisted ${eventTypeStr} event for ${cameraId} (track=${trackId}, class=${className})`, 'PIPELINE');

  try {
    if (eventTypeStr === 'person') {
      NotificationService.notifyObjectDetected(event, [className]).catch((err: unknown) => {
        logger.error('Object detection notification failed', 'PIPELINE', err);
      });
    } else if (eventTypeStr === 'face') {
      NotificationService.notifyUnknownFace(event).catch((err: unknown) => {
        logger.error('Unknown face notification failed', 'PIPELINE', err);
      });
    } else {
      NotificationService.notifyMotionEvent(event).catch((err: unknown) => {
        logger.error('Motion notification failed', 'PIPELINE', err);
      });
    }
  } catch (err) {
    logger.debug('Notification dispatch failed (non-blocking)', 'PIPELINE', err);
  }
}
