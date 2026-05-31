import { AppDataSource } from '../database.js';
import { logger } from '../utils/logger.js';

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

  removeEvent(eventId: string): boolean {
    const index = this.recentEvents.findIndex((e) => e.id === eventId);
    if (index === -1) return false;
    this.recentEvents.splice(index, 1);
    return true;
  }

  // ---- Alerts ----

  async addAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>): Promise<void> {
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

    try {
      await AppDataSource.query(
        `INSERT INTO alerts (id, type, severity, message, camera_id, acknowledged, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [newAlert.id, newAlert.type, newAlert.severity, newAlert.message, newAlert.cameraId || null, false, newAlert.timestamp]
      );
    } catch (error: any) {
      logger.warn(`Failed to persist alert to database: ${error.message}`, 'InMemoryState');
    }
  }

  getAlerts(): Alert[] {
    return [...this.alerts];
  }

  async loadAlertsFromDb(): Promise<void> {
    try {
      const rows = await AppDataSource.query(
        'SELECT id, type, severity, message, camera_id, acknowledged, created_at FROM alerts ORDER BY created_at DESC LIMIT $1',
        [MAX_ENTRIES]
      ) as any[];

      this.alerts = rows.map(r => ({
        id: r.id,
        type: r.type,
        severity: r.severity,
        message: r.message,
        timestamp: new Date(r.created_at),
        acknowledged: r.acknowledged,
        cameraId: r.camera_id || undefined,
      }));
      logger.info(`Loaded ${this.alerts.length} alerts from database`, 'InMemoryState');
    } catch (error: any) {
      logger.warn(`Could not load alerts from database: ${error.message}`, 'InMemoryState');
    }
  }

  async acknowledgeAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    try {
      await AppDataSource.query(
        'UPDATE alerts SET acknowledged = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [alertId]
      );
    } catch (error: any) {
      logger.warn(`Failed to persist alert acknowledgment to database: ${error.message}`, 'InMemoryState');
    }
    return true;
  }

  async deleteAlert(alertId: string): Promise<boolean> {
    const index = this.alerts.findIndex((a) => a.id === alertId);
    if (index === -1) return false;
    this.alerts.splice(index, 1);
    try {
      await AppDataSource.query('DELETE FROM alerts WHERE id = $1', [alertId]);
    } catch (error: any) {
      logger.warn(`Failed to delete alert from database: ${error.message}`, 'InMemoryState');
    }
    return true;
  }

  async clearAlerts(): Promise<void> {
    this.alerts = [];
    try {
      await AppDataSource.query('DELETE FROM alerts');
    } catch (error: any) {
      logger.warn(`Failed to clear alerts from database: ${error.message}`, 'InMemoryState');
    }
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

export const inMemoryState = new InMemoryStateService();
