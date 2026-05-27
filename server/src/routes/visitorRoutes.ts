import { Router, Request, Response } from 'express';
import { optionalAuth, requireUser } from '../middleware/auth.js';
import visitorService from '../services/visitorService.js';

const router = Router();

router.get('/list', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const persons = await visitorService.getKnownPersons();
    res.json({ success: true, visitors: persons });
  } catch (error) {
    console.error('Error listing visitors:', error);
    res.status(500).json({ success: false, error: 'Failed to list visitors' });
  }
});

router.get('/timeline', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const faces = await visitorService.getKnownFaces();
    res.json({ success: true, timeline: faces });
  } catch (error) {
    console.error('Error getting visitor timeline:', error);
    res.status(500).json({ success: false, error: 'Failed to get visitor timeline' });
  }
});

router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const persons = await visitorService.getKnownPersons();
    const person = persons.find((p: any) => p.id === req.params.id || p.person_id === req.params.id);
    if (!person) {
      res.status(404).json({ success: false, error: 'Visitor not found' });
      return;
    }
    res.json({ success: true, visitor: person });
  } catch (error) {
    console.error('Error getting visitor details:', error);
    res.status(500).json({ success: false, error: 'Failed to get visitor details' });
  }
});

router.put('/:id', requireUser, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }
    const personId = await visitorService.createPerson(name);
    res.json({ success: true, personId, message: `Visitor updated successfully` });
  } catch (error) {
    console.error('Error updating visitor:', error);
    res.status(500).json({ success: false, error: 'Failed to update visitor' });
  }
});

router.delete('/:id', requireUser, async (req: Request, res: Response) => {
  try {
    const deleted = await visitorService.deleteFace(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Visitor not found' });
      return;
    }
    res.json({ success: true, message: 'Visitor deleted successfully' });
  } catch (error) {
    console.error('Error deleting visitor:', error);
    res.status(500).json({ success: false, error: 'Failed to delete visitor' });
  }
});

export default router;
