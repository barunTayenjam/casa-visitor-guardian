import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/zodValidation.js';
import { settingsController } from '../controllers/SettingsController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

const UpdateSettingsSchema = z.object({
  // Minimal schema - SettingsController likely needs specific fields
  theme: z.string().optional(),
  language: z.string().optional(),
});

router.get('/', requireUser, (req, res) => settingsController.getSettings(req, res));
router.put('/', requireUser, validateBody(UpdateSettingsSchema), (req, res) => settingsController.updateSettings(req, res));

export default router;
