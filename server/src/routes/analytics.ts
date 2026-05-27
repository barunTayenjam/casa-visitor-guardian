import { Router } from 'express';
import { analyticsController } from '../controllers/AnalyticsController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/hourly', optionalAuth, (req, res) => analyticsController.getHourly(req, res));
router.get('/weekly', optionalAuth, (req, res) => analyticsController.getWeekly(req, res));
router.get('/monthly', optionalAuth, (req, res) => analyticsController.getMonthly(req, res));
router.get('/response-time', optionalAuth, (req, res) => analyticsController.getResponseTime(req, res));

export default router;
