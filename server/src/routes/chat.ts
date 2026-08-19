import { Router } from 'express';
import { chatController } from '../controllers/ChatController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.post('/message', requireUser, chatController.message);
router.get('/history', requireUser, chatController.history);
router.delete('/history', requireUser, chatController.clear);

export default router;