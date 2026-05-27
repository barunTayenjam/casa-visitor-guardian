import { Router } from 'express';
import { reviewController } from '../controllers/ReviewController.js';
import { requireUser, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/segments', requireUser, (req, res) => reviewController.getSegments(req, res));
router.get('/segments/:id', requireUser, (req, res) => reviewController.getSegmentById(req, res));
router.post('/segments/:id/acknowledge', requireUser, (req, res) => reviewController.acknowledgeSegment(req, res));
router.get('/timeline', optionalAuth, (req, res) => reviewController.getTimeline(req, res));
router.get('/active-objects/:camera', optionalAuth, (req, res) => reviewController.getActiveObjects(req, res));

export default router;
