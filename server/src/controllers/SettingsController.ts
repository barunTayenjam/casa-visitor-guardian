import { logger } from '../utils/logger.js';
import { Request, Response } from 'express';
import { BaseController } from './BaseController.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { inMemoryState, SystemSettings } from '../services/inMemoryStateService.js';
import { AppDataSource } from '../database.js';

const defaultSystemSettings: SystemSettings = {
  general: { systemName: 'Security System', timezone: 'UTC', language: 'en', theme: 'system', autoBackup: true, backupFrequency: 'daily' },
  storage: { retentionDays: 7, maxStorageGB: 100, autoCleanup: true, compressionEnabled: true, compressionQuality: 80 },
  notifications: { emailEnabled: false, emailAddress: '', pushEnabled: true, pushSoundEnabled: true, quietHoursEnabled: false, quietHoursStart: '22:00', quietHoursEnd: '07:00' },
};

async function loadSystemSettings(): Promise<SystemSettings> {
  const cached = inMemoryState.getSystemSettings();
  if (cached !== defaultSystemSettings && cached.general.systemName !== 'Security System') return cached;

  try {
    if (!AppDataSource.isInitialized) return defaultSystemSettings;
    const result = await AppDataSource.query(`SELECT * FROM system_settings ORDER BY created_at DESC LIMIT 1`);
    if (result && result.length > 0) {
      const db = result[0];
      const settings: SystemSettings = {
        general: { systemName: db.system_name || 'Security System', timezone: db.timezone || 'UTC', language: db.language || 'en', theme: db.theme || 'system', autoBackup: db.auto_backup !== false, backupFrequency: db.backup_frequency || 'daily' },
        storage: { retentionDays: db.retention_days || 30, maxStorageGB: parseFloat(db.max_storage_gb) || 100, autoCleanup: db.auto_cleanup !== false, compressionEnabled: db.compression_enabled !== false, compressionQuality: db.compression_quality || 80 },
        notifications: { emailEnabled: db.email_enabled === true, emailAddress: db.email_address || '', pushEnabled: db.push_enabled !== false, pushSoundEnabled: db.push_sound_enabled !== false, quietHoursEnabled: db.quiet_hours_enabled === true, quietHoursStart: db.quiet_hours_start || '22:00', quietHoursEnd: db.quiet_hours_end || '07:00' },
      };
      inMemoryState.setSystemSettings(settings);
      return settings;
    }
  } catch (error) {
    logger.error('Error loading system settings from database', 'Settings', error);
  }
  return defaultSystemSettings;
}

async function saveSystemSettings(settings: SystemSettings): Promise<boolean> {
  try {
    if (!AppDataSource.isInitialized) return false;
    await AppDataSource.query(
      `UPDATE system_settings SET system_name = $1, timezone = $2, language = $3, theme = $4, auto_backup = $5, backup_frequency = $6, retention_days = $7, max_storage_gb = $8, auto_cleanup = $9, compression_enabled = $10, compression_quality = $11, email_enabled = $12, email_address = $13, push_enabled = $14, push_sound_enabled = $15, quiet_hours_enabled = $16, quiet_hours_start = $17, quiet_hours_end = $18, updated_at = NOW() WHERE id = (SELECT id FROM system_settings LIMIT 1)`,
      [settings.general.systemName, settings.general.timezone, settings.general.language, settings.general.theme, settings.general.autoBackup, settings.general.backupFrequency, settings.storage.retentionDays, settings.storage.maxStorageGB, settings.storage.autoCleanup, settings.storage.compressionEnabled, settings.storage.compressionQuality, settings.notifications.emailEnabled, settings.notifications.emailAddress, settings.notifications.pushEnabled, settings.notifications.pushSoundEnabled, settings.notifications.quietHoursEnabled, settings.notifications.quietHoursStart, settings.notifications.quietHoursEnd]
    );
    inMemoryState.setSystemSettings(settings);
    return true;
  } catch (error) {
    logger.error('Error saving system settings to database', 'Settings', error);
    return false;
  }
}

export class SettingsController extends BaseController {
  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = await loadSystemSettings();
      this.ok(res, { settings });
    } catch (error) {
      this.serverError(res, error, 'getSettings');
    }
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const currentSettings = await loadSystemSettings();
      const { general, storage, notifications } = req.body;
      if (general) currentSettings.general = { ...currentSettings.general, ...general };
      if (storage) currentSettings.storage = { ...currentSettings.storage, ...storage };
      if (notifications) currentSettings.notifications = { ...currentSettings.notifications, ...notifications };

      const saved = await saveSystemSettings(currentSettings);
      if (saved) {
        this.ok(res, { message: 'Settings updated successfully', settings: currentSettings });
      } else {
        this.serverError(res, 'Failed to save settings to database');
      }
    } catch (error) {
      this.serverError(res, error, 'updateSettings');
    }
  }

  async getDetectionConfig(req: Request, res: Response): Promise<void> {
    try {
      const detectionConfigService = serviceRegistry.getDetectionConfigService();
      const config = await detectionConfigService.getConfig(req.query.camera as string);
      this.ok(res, { data: config });
    } catch (error) {
      if ((error as Error).message.includes('not been initialized')) {
        res.json({
          success: true,
          data: {
            thresholds: { person: { min_score: 0.3, threshold: 0.5 }, car: { min_score: 0.4, threshold: 0.6 }, dog: { min_score: 0.3, threshold: 0.4 }, package: { min_score: 0.25, threshold: 0.35 } },
            labelmap: { truck: 'car', bus: 'car', motorcycle: 'car' },
            score_history_length: 7,
          }
        });
        return;
      }
      this.serverError(res, error, 'getDetectionConfig');
    }
  }

  async updateDetectionConfig(req: Request, res: Response): Promise<void> {
    try {
      const detectionConfigService = serviceRegistry.getDetectionConfigService();
      const { camera, thresholds, labelmap, score_history_length } = req.body;
      await detectionConfigService.updateConfig(camera, { thresholds, labelmap, score_history_length });
      this.ok(res, {});
    } catch (error) {
      if ((error as Error).message.includes('not been initialized')) {
        res.status(503).json({ success: false, error: 'Detection config service not available' });
        return;
      }
      this.serverError(res, error, 'updateDetectionConfig');
    }
  }
}

export const settingsController = new SettingsController();
