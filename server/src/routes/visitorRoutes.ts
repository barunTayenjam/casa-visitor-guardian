import { logger } from '../utils/logger.js';
import { Router, Request, Response } from 'express';
import { optionalAuth, requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import visitorService from '../services/visitorService.js';

const router = Router();

router.get('/list', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const persons = await visitorService.getKnownPersons();
    res.json({ success: true, visitors: persons });
  } catch (error) {
     logger.error('Error listing visitors', 'Visitor', error);
    res.status(500).json({ success: false, error: 'Failed to list visitors' });
  }
});

router.get('/timeline', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const faces = await visitorService.getKnownFaces();
    res.json({ success: true, timeline: faces });
  } catch (error) {
     logger.error('Error getting visitor timeline', 'Visitor', error);
    res.status(500).json({ success: false, error: 'Failed to get visitor timeline' });
  }
});

router.get('/:id', optionalAuth, validate({
  params: {
    id: { type: 'string' as const, required: true, pattern: /^[a-zA-Z0-9_-]+$/, maxLength: 100 }
  }
}), async (req: Request, res: Response) => {
  try {
    const persons = await visitorService.getKnownPersons();
    const person = persons.find((p: any) => p.id === req.params.id || p.person_id === req.params.id);
    if (!person) {
      res.status(404).json({ success: false, error: 'Visitor not found' });
      return;
    }
    res.json({ success: true, visitor: person });
  } catch (error) {
     logger.error('Error getting visitor details', 'Visitor', error);
    res.status(500).json({ success: false, error: 'Failed to get visitor details' });
  }
});

router.put('/:id', requireUser, validate({
  params: {
    id: { type: 'string' as const, required: true, pattern: /^[a-zA-Z0-9_-]+$/, maxLength: 100 }
  },
  body: {
    name: { type: 'string' as const, required: true, minLength: 1, maxLength: 100 }
  }
}), async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
const updated = await visitorService.updatePerson(req.params.id, { name });
      if (updated) {
        res.json({ success: true, message: 'Visitor updated successfully' });
      } else {
        res.status(404).json({ success: false, error: 'Visitor not found' });
      }
  } catch (error) {
     logger.error('Error updating visitor', 'Visitor', error);
    res.status(500).json({ success: false, error: 'Failed to update visitor' });
  }
});

router.delete('/:id', requireUser, validate({
  params: {
    id: { type: 'string' as const, required: true, pattern: /^[a-zA-Z0-9_-]+$/, maxLength: 100 }
  }
}), async (req: Request, res: Response) => {
  try {
    const deleted = await visitorService.deleteFace(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Visitor not found' });
      return;
    }
    res.json({ success: true, message: 'Visitor deleted successfully' });
  } catch (error) {
     logger.error('Error deleting visitor', 'Visitor', error);
    res.status(500).json({ success: false, error: 'Failed to delete visitor' });
  }
});

export default router;
