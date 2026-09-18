import type { TrackingEvent } from '../services/pythonWsClient.js';

const BROADCAST_MIN_SCORE = 0.5;

export interface BroadcastDetection {
  class: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  trackId: number;
  identity?: string;
  identityConfidence?: number;
}

export class BroadcastGate {
  isBroadcastWorthy(score: number | undefined): boolean {
    return (score ?? 0) >= BROADCAST_MIN_SCORE;
  }

  shouldBroadcast(ev: TrackingEvent): boolean {
    if (!ev.cameraId) return false;
    if (ev.event === 'track_ended') return false;
    return this.isBroadcastWorthy(ev.score);
  }

  createDetection(ev: TrackingEvent): BroadcastDetection {
    return {
      class: ev.class,
      confidence: Math.round((ev.score ?? 0) * 100),
      bbox: {
        x: ev.bbox?.[0] ?? 0,
        y: ev.bbox?.[1] ?? 0,
        width: ev.bbox?.[2] ?? 0,
        height: ev.bbox?.[3] ?? 0,
      },
      trackId: ev.trackId,
      identity: ev.identity ?? undefined,
      identityConfidence: ev.identityConfidence,
    };
  }
}
