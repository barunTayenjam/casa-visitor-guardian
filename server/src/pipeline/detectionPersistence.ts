import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { Event } from '../models/Event.js';
import { EventDetection } from '../models/EventDetection.js';
import { HumanVerification } from '../models/HumanVerification.js';
import { AppDataSource } from '../database.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { getEventPath } from '../config/paths.js';
import { logger } from '../utils/logger.js';
import { TrackingEvent } from '../services/pythonWsClient.js';
import NotificationService from '../services/notificationService.js';
import { VEHICLE_CLASSES } from '../shared/constants.js';

export interface SceneDetection {
  className: string;
  classId?: number;
  score: number;
  bbox: { x: number; y: number; width: number; height: number };
  trackId: number;
  trackState?: string;
  trackletLen?: number;
  identity?: string | null;
  identityConfidence?: number;
  humanVerification?: TrackingEvent['humanVerification'];
  lastSeen: number;
}

export async function persistDetectionEvent(
  ev: TrackingEvent,
  scene?: SceneDetection[],
): Promise<void> {
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

  const isPerson = className === 'person';
  const isFace = !!identity && identity !== 'unknown';
  const isVehicle = VEHICLE_CLASSES.includes(className);
  const eventTypeStr = isPerson ? 'person' : isVehicle ? 'vehicle' : isFace ? 'face' : 'motion';

  let filePath = ev.filePath ?? '';
  try {
    // Person/vehicle images: meta persists for every detection, snapshots only
    // for persisted classes. Prefer the full-res snapshot Python saved with the
    // event; fall back to the last live frame (640x360 preview) for persons in
    // legacy/edge cases.
    if (isPerson || isVehicle) {
      if (!filePath) {
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
      } else if (!path.isAbsolute(filePath)) {
        const now = new Date();
        const dir = getEventPath('motion', now);
        await fsp.mkdir(dir, { recursive: true });
        filePath = path.join(dir, path.basename(filePath));
      }
    }
  } catch (err) {
    logger.warn(
      `[DetectionPersistence] Failed to save snapshot for event on ${cameraId}`,
      'PIPELINE',
      err,
    );
  }

  const severity: 'alert' | 'detection' | 'info' = isPerson
    ? 'alert'
    : isVehicle
      ? 'detection'
      : 'info';

  // Scope scene detections to the primary event class so person events don't
  // contain car/animal tracks and vehicle events don't contain person tracks.
  const allSceneDets =
    scene && scene.length > 0
      ? scene
      : [
          {
            className,
            classId: ev.classId,
            score,
            bbox: { x: bbox[0] ?? 0, y: bbox[1] ?? 0, width: bbox[2] ?? 0, height: bbox[3] ?? 0 },
            trackId,
            trackState: ev.trackState,
            trackletLen: ev.trackletLen,
            identity,
            identityConfidence,
            humanVerification: ev.humanVerification,
            lastSeen: Date.now(),
          },
        ];
  // Helper: Intersection-over-union for two bbox rects
  const iou = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => {
    const ax2 = a.x + a.width, ay2 = a.y + a.height;
    const bx2 = b.x + b.width, by2 = b.y + b.height;
    const interArea =
      Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
    const aArea = a.width * a.height, bArea = b.width * b.height;
    return interArea / (aArea + bArea - interArea);
  };

  // Filter out lost tracks and dedupe overlapping person bboxes (same person → 1)
  const activePersonDets = allSceneDets.filter(
    (d) => d.className === 'person' && (d.trackState ?? '') !== 'lost'
  );
  const seen: typeof activePersonDets = [];
  const personDets = activePersonDets.filter((d) => {
    const overlaps = seen.some((s) => iou(d.bbox, s.bbox) > 0.3);
    if (!overlaps) { seen.push(d); return true; }
    return false;
  });

  const sceneDets = isPerson
    ? personDets
    : isVehicle
      ? allSceneDets.filter((d) => VEHICLE_CLASSES.includes(d.className))
      : allSceneDets;

  // Identified detections only from verified/active persons
  const identifiedDets = personDets.filter((d) => !!d.identity && d.identity !== 'unknown');
  const byClass: Record<string, number> = {};
  for (const d of personDets) byClass[d.className] = (byClass[d.className] ?? 0) + 1;

  const event = new Event();
  event.event_type = eventTypeStr;
  event.severity = severity;
  event.camera_id = cameraId;
  event.file_path = filePath || null;
  event.timestamp =
    typeof ev.timestamp === 'number' ? new Date(ev.timestamp * 1000) : new Date(ev.timestamp);
  event.confidence = score;
  event.persons_detected = personDets.length;
  event.faces_detected = identifiedDets.length;
  event.known_faces_count = identifiedDets.length;
  event.unknown_faces_count = 0;
  event.object_detections = sceneDets.map((d) => ({
    class: d.className,
    confidence: Math.round(d.score * 100),
    bbox: d.bbox,
    trackId: d.trackId,
    trackState: d.trackState ?? null,
    trackletLen: d.trackletLen ?? null,
    classId: d.classId ?? null,
    identity: d.identity ?? null,
    identityConfidence: d.identityConfidence ?? null,
    humanVerified: d.humanVerification?.verified === true,
    verificationTier: d.humanVerification?.tier ?? null,
  }));
  event.face_detections = identifiedDets.map((d) => ({
    id: `track_${d.trackId}`,
    name: d.identity ?? 'unknown',
    isKnown: true,
    confidence: d.identityConfidence ?? 0,
    bbox: d.bbox,
  }));
  event.metadata = JSON.stringify({
    trackId,
    eventType,
    confidence: Math.round(score * 100),
    hasPersons: personDets.length > 0,
    hasFaces: identifiedDets.length > 0,
    personCount: personDets.length,
    faceCount: identifiedDets.length,
    scene: {
      total: sceneDets.length,
      byClass,
      distinctTracks: new Set(sceneDets.map((d) => d.trackId)).size,
    },
    ...(ev.humanVerification
      ? {
          humanVerification: {
            tier: ev.humanVerification.tier,
            keypoints: ev.humanVerification.keypoints,
            faceDetected: ev.humanVerification.face_detected,
            elapsedMs: ev.humanVerification.elapsed_ms,
          },
        }
      : {}),
  });

  event.scene_context = ev.sceneContext ?? null;
  event.threat_assessment = ev.threatAssessment ?? null;
  event.detection_summary = ev.detectionSummary ?? null;
  event.motion_stats = ev.motionStats ?? null;

  await AppDataSource.getRepository(Event).save(event);

  try {
    const detRepo = AppDataSource.getRepository(EventDetection);
    const detRows = sceneDets.map((d) => ({
      event_id: event.id,
      camera_id: cameraId,
      timestamp: event.timestamp,
      class: d.className,
      class_id: d.classId ?? null,
      confidence: d.score ?? null,
      bbox_x: d.bbox ? Math.round(d.bbox.x) : null,
      bbox_y: d.bbox ? Math.round(d.bbox.y) : null,
      bbox_w: d.bbox ? Math.round(d.bbox.width) : null,
      bbox_h: d.bbox ? Math.round(d.bbox.height) : null,
      track_id: d.trackId ?? null,
      track_state: d.trackState ?? null,
      tracklet_len: d.trackletLen ?? null,
      identity: d.identity ?? null,
      identity_confidence: d.identityConfidence ?? null,
      human_verified: d.humanVerification?.verified ?? null,
      verification_tier: d.humanVerification?.tier ?? null,
      person_attributes: d.trackId === trackId ? ev.personAttributes ?? null : null,
      face_embedding: d.trackId === trackId ? ev.faceEmbedding ?? null : null,
    }));
    if (detRows.length > 0)
      await detRepo.save(detRows as unknown as import('typeorm').DeepPartial<EventDetection>[]);
  } catch (err) {
    logger.warn(
      `[DetectionPersistence] Failed to save detection rows for ${cameraId}`,
      'PIPELINE',
      err,
    );
  }
  logger.info(
    `[DetectionPersistence] Persisted ${eventTypeStr} event for ${cameraId} (track=${trackId}, class=${className})`,
    'PIPELINE',
  );

  if (ev.humanVerification || personDets.length > 0) {
    try {
      const repo = AppDataSource.getRepository(HumanVerification);
      const rows = personDets
        .filter((d) => d.humanVerification)
        .map((d) => ({
          eventId: event.id,
          cameraId,
          trackId: String(d.trackId),
          verified: d.humanVerification!.verified,
          tier: d.humanVerification!.tier,
          keypoints: d.humanVerification!.keypoints ?? 0,
          faceDetected: d.humanVerification!.face_detected ?? false,
          yoloScore: d.humanVerification!.yolo_score ?? d.score,
          roiWidth: d.humanVerification!.roi_w ?? 0,
          roiHeight: d.humanVerification!.roi_h ?? 0,
          elapsedMs: d.humanVerification!.elapsed_ms ?? 0,
        }));
      if (ev.humanVerification && !rows.some((r) => r.trackId === String(trackId))) {
        const hv = ev.humanVerification;
        rows.push({
          eventId: event.id,
          cameraId,
          trackId: String(trackId),
          verified: hv.verified,
          tier: hv.tier,
          keypoints: hv.keypoints ?? 0,
          faceDetected: hv.face_detected ?? false,
          yoloScore: hv.yolo_score ?? 0,
          roiWidth: hv.roi_w ?? 0,
          roiHeight: hv.roi_h ?? 0,
          elapsedMs: hv.elapsed_ms ?? 0,
        });
      }
      if (rows.length > 0) await repo.insert(rows);
    } catch (err) {
      logger.warn(
        `[DetectionPersistence] Failed to save human verification for ${cameraId}`,
        'PIPELINE',
        err,
      );
    }
  }

  try {
    if (eventTypeStr === 'person') {
      NotificationService.notifyObjectDetected(event, [className]).catch((err: unknown) => {
        logger.error('Object detection notification failed', 'PIPELINE', err);
      });
    } else if (eventTypeStr === 'face') {
      NotificationService.notifyUnknownFace(event).catch((err: unknown) => {
        logger.error('Unknown face notification failed', 'PIPELINE', err);
      });
    } else if (eventTypeStr === 'vehicle') {
      NotificationService.notifyObjectDetected(event, [className]).catch((err: unknown) => {
        logger.error('Vehicle notification failed', 'PIPELINE', err);
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
