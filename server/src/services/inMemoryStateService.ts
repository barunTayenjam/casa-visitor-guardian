// In-memory state service for recent events, alerts, and cached system settings
// Replaces global mutable state previously declared in routes/index.ts

// ---- Type Definitions ----

export interface MotionEvent {
  id: string;
  cameraId: string;
  timestamp: string;
  imagePath: string;
  confidence: number;
  duration: number;
  cameraName?: string;
  labels?: string[];
  location?: string;
}

export interface Alert {
  id: string;
  type: 'motion' | 'camera' | 'system';
  severity: 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  cameraId?: string;
}

export interface GeneralSettings {
  systemName: string;
  timezone: string;
  language: string;
  theme: string;
  autoBackup: boolean;
  backupFrequency: string;
}

export interface StorageSettings {
  retentionDays: number;
  maxStorageGB: number;
  autoCleanup: boolean;
  compressionEnabled: boolean;
  compressionQuality: number;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  emailAddress: string;
  pushEnabled: boolean;
  pushSoundEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface SystemSettings {
  general: GeneralSettings;
  storage: StorageSettings;
  notifications: NotificationSettings;
}

const MAX_ENTRIES = 100;

const defaultSystemSettings: SystemSettings = {
  general: {
    systemName: 'Security System',
    timezone: 'UTC',
    language: 'en',
    theme: 'system',
    autoBackup: true,
    backupFrequency: 'daily',
  },
  storage: {
    retentionDays: 7,
    maxStorageGB: 100,
    autoCleanup: true,
    compressionEnabled: true,
    compressionQuality: 80,
  },
  notifications: {
    emailEnabled: false,
    emailAddress: '',
    pushEnabled: true,
    pushSoundEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  },
};

export class InMemoryStateService {
  private recentEvents: MotionEvent[] = [];
  private alerts: Alert[] = [];
  private cachedSystemSettings: SystemSettings | null = null;

  // ---- Recent Events ----

  addRecentEvent(event: MotionEvent): void {
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > MAX_ENTRIES) {
      this.recentEvents.pop();
    }
  }

  getRecentEvents(): MotionEvent[] {
    return [...this.recentEvents];
  }

  clearRecentEvents(): void {
    this.recentEvents = [];
  }

  // ---- Alerts ----

  addAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const newAlert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false,
      ...alert,
    };
    this.alerts.unshift(newAlert);
    if (this.alerts.length > MAX_ENTRIES) {
      this.alerts.pop();
    }
  }

  getAlerts(): Alert[] {
    return [...this.alerts];
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }

  deleteAlert(alertId: string): boolean {
    const index = this.alerts.findIndex((a) => a.id === alertId);
    if (index === -1) return false;
    this.alerts.splice(index, 1);
    return true;
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  // ---- System Settings ----

  getSystemSettings(): SystemSettings {
    return this.cachedSystemSettings ?? defaultSystemSettings;
  }

  setSystemSettings(settings: SystemSettings): void {
    this.cachedSystemSettings = settings;
  }

  clearSystemSettings(): void {
    this.cachedSystemSettings = null;
  }

  getDefaultSettings(): SystemSettings {
    return { ...defaultSystemSettings };
  }
}

// Singleton instance
export const inMemoryState = new InMemoryStateService();
