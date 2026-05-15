import { Express, Request, Response } from 'express';
import { optionalAuth, requireUser } from '../middleware/auth.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { inMemoryState, SystemSettings } from '../services/inMemoryStateService.js';
import { AppDataSource } from '../database.js';

// Default settings as fallback
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

// Load settings from database
async function loadSystemSettings(): Promise<SystemSettings> {
  const cached = inMemoryState.getSystemSettings();
  if (cached !== defaultSystemSettings && cached.general.systemName !== 'Security System') {
    return cached;
  }

  try {
    if (!AppDataSource.isInitialized) {
      return defaultSystemSettings;
    }

    const result = await AppDataSource.query(`SELECT * FROM system_settings ORDER BY created_at DESC LIMIT 1`);

    if (result && result.length > 0) {
      const db = result[0];
      const settings: SystemSettings = {
        general: {
          systemName: db.system_name || 'Security System',
          timezone: db.timezone || 'UTC',
          language: db.language || 'en',
          theme: db.theme || 'system',
          autoBackup: db.auto_backup !== false,
          backupFrequency: db.backup_frequency || 'daily',
        },
        storage: {
          retentionDays: db.retention_days || 30,
          maxStorageGB: parseFloat(db.max_storage_gb) || 100,
          autoCleanup: db.auto_cleanup !== false,
          compressionEnabled: db.compression_enabled !== false,
          compressionQuality: db.compression_quality || 80,
        },
        notifications: {
          emailEnabled: db.email_enabled === true,
          emailAddress: db.email_address || '',
          pushEnabled: db.push_enabled !== false,
          pushSoundEnabled: db.push_sound_enabled !== false,
          quietHoursEnabled: db.quiet_hours_enabled === true,
          quietHoursStart: db.quiet_hours_start || '22:00',
          quietHoursEnd: db.quiet_hours_end || '07:00',
        },
      };
      inMemoryState.setSystemSettings(settings);
      return settings;
    }
  } catch (error) {
    console.error('Error loading system settings from database:', error);
  }

  return defaultSystemSettings;
}

// Save settings to database
async function saveSystemSettings(settings: SystemSettings): Promise<boolean> {
  try {
    if (!AppDataSource.isInitialized) {
      return false;
    }

    await AppDataSource.query(
      `UPDATE system_settings SET
        system_name = $1, timezone = $2, language = $3, theme = $4,
        auto_backup = $5, backup_frequency = $6, retention_days = $7,
        max_storage_gb = $8, auto_cleanup = $9, compression_enabled = $10,
        compression_quality = $11, email_enabled = $12, email_address = $13,
        push_enabled = $14, push_sound_enabled = $15, quiet_hours_enabled = $16,
        quiet_hours_start = $17, quiet_hours_end = $18, updated_at = NOW()
      WHERE id = (SELECT id FROM system_settings LIMIT 1)`,
      [
        settings.general.systemName, settings.general.timezone, settings.general.language,
        settings.general.theme, settings.general.autoBackup, settings.general.backupFrequency,
        settings.storage.retentionDays, settings.storage.maxStorageGB, settings.storage.autoCleanup,
        settings.storage.compressionEnabled, settings.storage.compressionQuality,
        settings.notifications.emailEnabled, settings.notifications.emailAddress,
        settings.notifications.pushEnabled, settings.notifications.pushSoundEnabled,
        settings.notifications.quietHoursEnabled, settings.notifications.quietHoursStart,
        settings.notifications.quietHoursEnd,
      ]
    );

    inMemoryState.setSystemSettings(settings);
    return true;
  } catch (error) {
    console.error('Error saving system settings to database:', error);
    return false;
  }
}

export function configureSettingsRoutes(app: Express) {
  // Get system settings
  app.get('/api/settings', requireUser, async (req: Request, res: Response) => {
    try {
      const settings = await loadSystemSettings();
      res.json({ success: true, settings });
    } catch (error) {
      console.error('Error getting system settings:', error);
      res.status(500).json({ success: false, error: 'Failed to get system settings' });
    }
  });

  // Update system settings
  app.put('/api/settings', requireUser, async (req: Request, res: Response) => {
    try {
      const currentSettings = await loadSystemSettings();
      const { general, storage, notifications } = req.body;

      if (general) currentSettings.general = { ...currentSettings.general, ...general };
      if (storage) currentSettings.storage = { ...currentSettings.storage, ...storage };
      if (notifications) currentSettings.notifications = { ...currentSettings.notifications, ...notifications };

      const saved = await saveSystemSettings(currentSettings);
      if (saved) {
        res.json({ success: true, message: 'Settings updated successfully', settings: currentSettings });
      } else {
        res.status(500).json({ success: false, error: 'Failed to save settings to database' });
      }
    } catch (error) {
      console.error('Error updating system settings:', error);
      res.status(500).json({ success: false, error: 'Failed to update system settings' });
    }
  });

  // Detection config routes (moved from inline routes in index.ts)

  // Get detection config
  app.get('/api/detection/config', optionalAuth, async (req: Request, res: Response) => {
    try {
      const detectionConfigService = serviceRegistry.getDetectionConfigService();
      const config = await detectionConfigService.getConfig(req.query.camera as string);
      res.json({ success: true, data: config });
    } catch (error) {
      if ((error as Error).message.includes('not been initialized')) {
        return res.json({
          success: true,
          data: {
            thresholds: {
              person: { min_score: 0.3, threshold: 0.5 },
              car: { min_score: 0.4, threshold: 0.6 },
              dog: { min_score: 0.3, threshold: 0.4 },
              package: { min_score: 0.25, threshold: 0.35 },
            },
            labelmap: { truck: 'car', bus: 'car', motorcycle: 'car' },
            score_history_length: 7,
          }
        });
      }
      console.error('Error fetching detection config:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch detection config' });
    }
  });

  // Update detection config
  app.put('/api/detection/config', requireUser, async (req: Request, res: Response) => {
    try {
      const detectionConfigService = serviceRegistry.getDetectionConfigService();
      const { camera, thresholds, labelmap, score_history_length } = req.body;
      await detectionConfigService.updateConfig(camera, { thresholds, labelmap, score_history_length });
      res.json({ success: true });
    } catch (error) {
      if ((error as Error).message.includes('not been initialized')) {
        return res.status(503).json({ success: false, error: 'Detection config service not available' });
      }
      console.error('Error updating detection config:', error);
      res.status(500).json({ success: false, error: 'Failed to update detection config' });
    }
  });
}
