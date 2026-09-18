import type { TrackingEvent } from '../services/pythonWsClient.js';
import { VEHICLE_CLASSES } from '../shared/constants.js';

export class TrackDeduplicator {
  private persistedTracks = new Set<string>();
  private lastSavedPerCameraClass = new Map<
    string,
    { bbox: { x: number; y: number; w: number; h: number }; ts: number }
  >();

  shouldPersist(ev: TrackingEvent): boolean {
    if (!ev.cameraId) return false;

    const trackKey = `${ev.cameraId}:${ev.trackId}`;

    if (ev.event === 'track_ended') {
      this.persistedTracks.delete(trackKey);
      return false;
    }

    if (this.persistedTracks.has(trackKey)) return false;
    if (ev.event !== 'track_started' && ev.event !== 'track_updated') return false;

    const isVehicleClass = VEHICLE_CLASSES.includes(ev.class);

    if (ev.class === 'person') {
      return !!ev.filePath;
    }

    const sceneKey = `${ev.cameraId}:${ev.class}`;
    const prev = this.lastSavedPerCameraClass.get(sceneKey);
    const now = Date.now();

    if (prev) {
      const dx = Math.abs((ev.bbox?.[0] ?? 0) - prev.bbox.x);
      const dy = Math.abs((ev.bbox?.[1] ?? 0) - prev.bbox.y);
      const dw = Math.abs((ev.bbox?.[2] ?? 0) - prev.bbox.w);
      const dh = Math.abs((ev.bbox?.[3] ?? 0) - prev.bbox.h);
      const bboxShift = Math.sqrt(dx * dx + dy * dy + dw * dw + dh * dh);

      if (bboxShift < 80 && now - prev.ts < 10 * 60 * 1000) {
        return false;
      }
    }

    const shouldPersist = isVehicleClass ? !!ev.filePath : true;
    if (shouldPersist) {
      this.lastSavedPerCameraClass.set(sceneKey, {
        bbox: {
          x: ev.bbox?.[0] ?? 0,
          y: ev.bbox?.[1] ?? 0,
          w: ev.bbox?.[2] ?? 0,
          h: ev.bbox?.[3] ?? 0,
        },
        ts: now,
      });
    }

    return shouldPersist;
  }

  markPersisted(ev: TrackingEvent): void {
    if (!ev.cameraId) return;
    const trackKey = `${ev.cameraId}:${ev.trackId}`;
    this.persistedTracks.add(trackKey);
  }

  clearTrack(cameraId: string, trackId: number): void {
    this.persistedTracks.delete(`${cameraId}:${trackId}`);
  }
}
