import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { nvidiaController } from '../controllers/NvidiaController.js';

const router = Router();

router.use(optionalAuth);

router.post('/analyze', authenticate(), validate({
  body: {
    image: { type: 'string' as const, required: false },
    imagePath: { type: 'string' as const, required: false }
  }
}), (req, res) => nvidiaController.analyze(req, res));
router.post('/analyze-event', authenticate(), validate({
  body: {
    image: { type: 'string' as const, required: false },
    imagePath: { type: 'string' as const, required: false }
  }
}), (req, res) => nvidiaController.analyzeEvent(req, res));
router.get('/health', (req, res) => nvidiaController.health(req, res));
router.get('/results', authenticate(), (req, res) => nvidiaController.getResults(req, res));
router.get('/models', authenticate(), (req, res) => nvidiaController.getModels(req, res));
router.put('/config', authenticate(), validate({
  body: {}
}), (req, res) => nvidiaController.updateConfig(req, res));
router.post('/analyze-with-bboxes', authenticate(), validate({
  body: {
    image: { type: 'string' as const, required: false },
    imagePath: { type: 'string' as const, required: false }
  }
}), (req, res) => nvidiaController.analyzeWithBboxes(req, res));
router.post('/analyze-persons', authenticate(), validate({
  body: {
    image: { type: 'string' as const, required: false },
    imagePath: { type: 'string' as const, required: false }
  }
}), (req, res) => nvidiaController.analyzePersons(req, res));
router.post('/analyze-event-with-bboxes', authenticate(), validate({
  body: {
    image: { type: 'string' as const, required: false },
    imagePath: { type: 'string' as const, required: false }
  }
}), (req, res) => nvidiaController.analyzeEventWithBboxes(req, res));

export default router;