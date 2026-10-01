import { Router } from 'express';
import { eventController } from '../controllers/EventController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/list-enhanced', optionalAuth, (req, res) => eventController.listEnhanced(req, res));

export default router;
