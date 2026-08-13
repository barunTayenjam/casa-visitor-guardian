export interface TrackingEvent {
  trackId: number;
  cameraId: string;
  timestamp: number;
  event: 'track_started' | 'track_updated' | 'track_ended';
  bbox: number[];
  score: number;
  class: string;
}

export interface DetectionEvent {
  cameraId: string;
  eventType: 'motion' | 'person' | 'face';
  timestamp: Date;
  details: Record<string, unknown>;
}

export interface SystemEvent {
  type: 'service_start' | 'service_stop' | 'error' | 'health_warning';
  message: string;
  source: string;
  timestamp: Date;
}

export type AppEvent = 
  | { type: 'tracking', payload: TrackingEvent }
  | { type: 'detection', payload: DetectionEvent }
  | { type: 'system', payload: SystemEvent };
