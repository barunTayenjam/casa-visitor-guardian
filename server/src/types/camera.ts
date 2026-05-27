export type CameraStatus = 'online' | 'offline' | 'warning';

export interface CameraResponse {
  id: string;
  name: string;
  status: CameraStatus;
  isActive: boolean;
  nightMode: boolean;
  retryCount: number;
  lastError: string | null;
  config: unknown;
  streams: {
    detect: CameraStreamInfo | null;
    record: CameraStreamInfo | null;
  };
}

export interface CameraStreamInfo {
  isActive: boolean;
  fps: number;
  width: number;
  height: number;
  hasFrame: boolean;
  frameSize: number;
}
