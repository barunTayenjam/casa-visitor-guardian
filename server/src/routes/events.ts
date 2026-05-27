import { Router } from 'express';
import { eventController } from '../controllers/EventController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/list-enhanced', optionalAuth, (req, res) => eventController.listEnhanced(req, res));
router.get('/history', optionalAuth, (req, res) => eventController.getHistory(req, res));

export default router;
