import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { nvidiaController } from '../controllers/NvidiaController.js';

const router = Router();

router.use(optionalAuth);

router.post('/analyze', authenticate(), (req, res) => nvidiaController.analyze(req, res));
router.post('/analyze-event', authenticate(), (req, res) => nvidiaController.analyzeEvent(req, res));
router.get('/health', (req, res) => nvidiaController.health(req, res));
router.get('/results', (req, res) => nvidiaController.getResults(req, res));
router.get('/models', (req, res) => nvidiaController.getModels(req, res));
router.put('/config', authenticate(), (req, res) => nvidiaController.updateConfig(req, res));
router.post('/analyze-with-bboxes', authenticate(), (req, res) => nvidiaController.analyzeWithBboxes(req, res));
router.post('/analyze-persons', authenticate(), (req, res) => nvidiaController.analyzePersons(req, res));
router.post('/analyze-event-with-bboxes', authenticate(), (req, res) => nvidiaController.analyzeEventWithBboxes(req, res));

export default router;