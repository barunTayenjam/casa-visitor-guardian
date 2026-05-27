import { Router } from 'express';
import { settingsController } from '../controllers/SettingsController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/', requireUser, (req, res) => settingsController.getSettings(req, res));
router.put('/', requireUser, (req, res) => settingsController.updateSettings(req, res));

export default router;
