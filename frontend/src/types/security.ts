export interface CameraStreamInfo {
  isActive: boolean;
  fps: number;
  width: number;
  height: number;
  hasFrame: boolean;
  frameSize: number;
}

export interface Camera {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning';
  streamUrl?: string;
  thumbnail: string;
  location: string;
  detectionEnabled: boolean;
  sensitivity: number;
  lastSeen: Date;
  resolution?: string;
  fps?: number;
  error?: string;
  // Dual-stream architecture
  streams?: {
    detect?: CameraStreamInfo;
    record?: CameraStreamInfo;
    live?: CameraStreamInfo;
  };
  // Configuration
  config?: {
    detect: {
      width: number;
      height: number;
      fps: number;
    };
    objects?: {
      track: string[];
      filters?: Record<string, {
        minArea?: number;
        maxArea?: number;
        threshold?: number;
      }>;
    };
    zones?: Array<{
      id: string;
      name: string;
      coordinates: number[][];
      objects?: string[];
      inertia?: number;
      loiteringTime?: number;
    }>;
  };
}

export interface MotionEvent {
  id: string;
  cameraId: string;
  cameraName: string;
  timestamp: Date;
  imageUrl: string | null;
  confidence: number;
  labels: string[];
  location: string;
  duration: number;
  archived: boolean;
  // Detection metadata from API
  metadata?: Record<string, unknown>;
  // Bounding boxes for detections
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // Multiple detections (persons, faces, objects)
  detections?: Array<{
    type: 'person' | 'face' | 'object';
    confidence: number;
    name?: string;
    isKnown?: boolean;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  // Count fields
  personCount?: number;
  faceCount?: number;
  knownFaces?: number;
  unknownFaces?: number;
  // Environmental data
  lightLevel?: number;
  motionArea?: number;
  // Raw metadata object
  rawMetadata?: Record<string, unknown>;
}

export interface SystemStatus {
  status: 'healthy' | 'warning' | 'error';
  uptime: number;
  totalCameras: number;
  onlineCameras: number;
  totalEvents: number;
  todayEvents: number;
  storageUsed: number;
  storageTotal: number;
}

export interface Alert {
  id: string;
  type: 'motion' | 'system' | 'camera';
  severity: 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  cameraId?: string;
}

export interface AnalyticsData {
  eventsToday: number;
  eventsThisWeek: number;
  eventsThisMonth: number;
  hourlyData: Array<{ hour: number; count: number }>;
  cameraData: Array<{ camera: string; count: number }>;
  averageResponseTime: number;
}

export interface DetectionResult {
  class: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Detection {
  class: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DetectionEvent {
  cameraId: string;
  detections: Detection[];
  timestamp: string;
  detectionResolution?: { width: number; height: number };
  displayResolution?: { width: number; height: number };
  metadata?: {
    maxConfidence: number;
    totalDetections: number;
    personCount: number;
    processingTime: number;
  };
}

export interface FaceDetection {
  id: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  embedding?: number[];
  landmark?: {
    leftEye: [number, number];
    rightEye: [number, number];
    nose: [number, number];
    mouth: [number, number];
  };
  isKnown?: boolean;
}

export interface PersonDetectedEvent {
  cameraId: string;
  timestamp: string;
  persons: DetectionResult[];
  imagePath: string;
}

export interface FaceDetectedEvent {
  cameraId: string;
  timestamp: string;
  faces: FaceDetection[];
  imagePath: string;
}

export interface SystemSettings {
  general: {
    systemName: string;
    timezone: string;
    autoBackup: boolean;
    language: string;
    theme: string;
    backupFrequency: string;
  };
  storage: {
    retentionDays: number;
    maxStorageGB: number;
    autoCleanup: boolean;
    compressionEnabled: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    emailAddress: string;
    pushEnabled: boolean;
    pushSoundEnabled: boolean;
  };
}
