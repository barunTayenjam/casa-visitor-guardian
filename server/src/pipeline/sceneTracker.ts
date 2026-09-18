import type { SceneDetection } from '../pipeline/detectionPersistence.js';
import type { TrackingEvent } from '../services/pythonWsClient.js';

const SCENE_WINDOW_MS = 5000;

export class SceneTracker {
  private sceneByCamera = new Map<string, Map<number, SceneDetection>>();

  track(ev: TrackingEvent): void {
    if (!ev.cameraId || ev.event === 'track_ended') return;

    let scene = this.sceneByCamera.get(ev.cameraId);
    if (!scene) {
      scene = new Map();
      this.sceneByCamera.set(ev.cameraId, scene);
    }

    const now = Date.now();
    for (const [tid, det] of scene) {
      if (now - det.lastSeen > SCENE_WINDOW_MS) scene.delete(tid);
    }

    scene.set(ev.trackId, {
      className: ev.class,
      classId: ev.classId,
      score: ev.score ?? 0,
      bbox: {
        x: ev.bbox?.[0] ?? 0,
        y: ev.bbox?.[1] ?? 0,
        width: ev.bbox?.[2] ?? 0,
        height: ev.bbox?.[3] ?? 0,
      },
      trackId: ev.trackId,
      trackState: ev.trackState,
      trackletLen: ev.trackletLen,
      identity: ev.identity,
      identityConfidence: ev.identityConfidence,
      humanVerification: ev.humanVerification,
      lastSeen: now,
    });
  }

  snapshot(cameraId: string): SceneDetection[] {
    const scene = this.sceneByCamera.get(cameraId);
    if (!scene) return [];
    const now = Date.now();
    return Array.from(scene.values()).filter((d) => now - d.lastSeen <= SCENE_WINDOW_MS);
  }

  clearTrack(cameraId: string, trackId: number): void {
    this.sceneByCamera.get(cameraId)?.delete(trackId);
  }
}
