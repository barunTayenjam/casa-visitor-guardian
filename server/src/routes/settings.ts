import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/zodValidation.js';
import { settingsController } from '../controllers/SettingsController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

// Must cover every group SettingsController.updateSettings merges from
// req.body (general/storage/notifications) — anything not listed here is
// stripped by zod and the save silently becomes a no-op.
const UpdateSettingsSchema = z.object({
  general: z
    .object({
      systemName: z.string().min(1).max(255).optional(),
      timezone: z.string().min(1).max(64).optional(),
      language: z.string().min(1).max(32).optional(),
      theme: z.string().min(1).max(32).optional(),
      autoBackup: z.boolean().optional(),
      backupFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
    })
    .optional(),
  storage: z
    .object({
      retentionDays: z.number().int().min(1).max(3650).optional(),
      maxStorageGB: z.number().min(1).max(100000).optional(),
      autoCleanup: z.boolean().optional(),
      compressionEnabled: z.boolean().optional(),
      compressionQuality: z.number().int().min(1).max(100).optional(),
    })
    .optional(),
  notifications: z
    .object({
      emailEnabled: z.boolean().optional(),
      emailAddress: z.string().max(320).optional(),
      pushEnabled: z.boolean().optional(),
      pushSoundEnabled: z.boolean().optional(),
      quietHoursEnabled: z.boolean().optional(),
      quietHoursStart: z.string().max(5).optional(),
      quietHoursEnd: z.string().max(5).optional(),
    })
    .optional(),
});

router.get('/', requireUser, (req, res) => settingsController.getSettings(req, res));
router.put('/', requireUser, validateBody(UpdateSettingsSchema), (req, res) =>
  settingsController.updateSettings(req, res),
);

export default router;
