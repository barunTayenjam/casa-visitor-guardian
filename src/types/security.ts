
export interface Camera {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning';
  streamUrl: string;
  thumbnail: string;
  location: string;
  detectionEnabled: boolean;
  sensitivity: number;
  lastSeen: Date;
  resolution: string;
  fps: number;
}

export interface DetectionEvent {
  id:string;
  cameraId: string;
  cameraName: string;
  timestamp: Date;
  imageUrl: string;
  confidence: number;
  labels: ('motion' | 'person')[];
  location: string;
  duration: number;
  archived: boolean;
  type: 'motion' | 'person';
  boundingBoxes?: { x: number; y: number; width: number; height: number }[];
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
