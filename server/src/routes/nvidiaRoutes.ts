import { Router } from 'express';
import { z } from 'zod';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/zodValidation.js';
import { nvidiaController } from '../controllers/NvidiaController.js';

const router = Router();

router.use(optionalAuth);

const analysisSchema = z.object({
  image: z.string().optional(),
  imagePath: z.string().optional(),
  eventId: z.string().optional(),
});

router.post('/analyze', authenticate(), validateBody(analysisSchema), (req, res) =>
  nvidiaController.analyze(req, res),
);
router.post('/analyze-event', authenticate(), validateBody(analysisSchema), (req, res) =>
  nvidiaController.analyzeEvent(req, res),
);
router.get('/health', (req, res) => nvidiaController.health(req, res));
router.get('/status', (req, res) => nvidiaController.health(req, res));
router.get('/results', authenticate(), (req, res) => nvidiaController.getResults(req, res));
router.get('/models', authenticate(), (req, res) => nvidiaController.getModels(req, res));
router.put('/config', authenticate(), (req, res) => nvidiaController.updateConfig(req, res));
router.post('/analyze-with-bboxes', authenticate(), validateBody(analysisSchema), (req, res) =>
  nvidiaController.analyzeWithBboxes(req, res),
);
router.post('/analyze-persons', authenticate(), validateBody(analysisSchema), (req, res) =>
  nvidiaController.analyzePersons(req, res),
);
router.post(
  '/analyze-event-with-bboxes',
  authenticate(),
  validateBody(analysisSchema),
  (req, res) => nvidiaController.analyzeEventWithBboxes(req, res),
);

export default router;
