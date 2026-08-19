import { Router } from 'express';
import { detectionDataController } from '../controllers/DetectionDataController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/', requireUser, detectionDataController.list);
router.get('/stats', requireUser, detectionDataController.stats);

export default router;
