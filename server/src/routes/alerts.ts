import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/zodValidation.js';
import { alertController } from '../controllers/AlertController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/', requireUser, (req, res) => alertController.getAll(req, res));
router.post('/:id/acknowledge', requireUser, (req, res) => alertController.acknowledge(req, res));
router.delete('/:id', requireUser, (req, res) => alertController.remove(req, res));

export default router;
