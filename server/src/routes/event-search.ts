import { Router, Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import eventSearchService from '../services/eventSearchService.js';
import { inMemoryState } from '../services/inMemoryStateService.js';
import { optionalAuth, requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/search', optionalAuth, async (req: Request, res: Response) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      cameraId: req.query.cameraId as string,
      eventType: req.query.eventType as string,
      confidence: req.query.confidence as string,
      faceStatus: req.query.faceStatus as string,
      page: parseInt(req.query.page as string) || 1,
      pageSize: Math.min(parseInt(req.query.pageSize as string) || 20, 100),
      sortBy: req.query.sortBy as string,
      sortOrder: (req.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' as const : 'DESC' as const,
    };
    const result = await eventSearchService.searchEvents(filters);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error searching events:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to search events' });
  }
});

router.get('/search/legacy', optionalAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const result = await eventSearchService.searchEventsLegacy({
      page,
      pageSize,
      cameraId: req.query.cameraId as string,
      searchQuery: req.query.searchQuery as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error searching events:', error);
    res.status(500).json({ success: false, error: 'Failed to search events' });
  }
});

router.get('/stats/today', optionalAuth, async (req: Request, res: Response) => {
  try {
    const count = await eventSearchService.getTodayEventCount();
    res.json({ success: true, count });
  } catch (error) {
    console.error('Error fetching daily stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch daily stats' });
  }
});

router.get('/stats/calendar', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { year, month, camera_id } = req.query;
    const currentYear = year ? parseInt(year as string) : new Date().getFullYear();
    const currentMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
    const result = await eventSearchService.getCalendarStats(currentYear, currentMonth, camera_id as string);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching calendar stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch calendar stats' });
  }
});

router.get('/stats/range', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, camera_id } = req.query;
    if (!start_date || !end_date) { res.status(400).json({ success: false, error: 'Start and end dates required' }); return; }
    const stats = await eventSearchService.getRangeStats(start_date as string, end_date as string, camera_id as string);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching range stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch range stats' });
  }
});

router.get('/list', optionalAuth, async (req: Request, res: Response) => {
  try {
    const files = await eventSearchService.listEventFiles();
    res.json({ success: true, files });
  } catch (error) {
    console.error('Error listing events:', error);
    res.status(500).json({ success: false, error: 'Failed to list events' });
  }
});

router.get('/:id/details', optionalAuth, async (req: Request, res: Response) => {
  try {
    const event = await eventSearchService.getEventDetails(req.params.id);
    if (!event) { res.status(404).json({ success: false, error: 'Event not found' }); return; }
    res.json({ success: true, event });
  } catch (error) {
    console.error('Failed to fetch event details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch event details' });
  }
});

router.get('/image/:filename', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, error: 'Invalid filename' });
    }

    const publicImagePath = path.join(process.cwd(), 'public', 'events', filename);
    if (fs.existsSync(publicImagePath)) return res.sendFile(publicImagePath);

    try {
      const storagePath = await eventSearchService.lookupEventImagePath(filename);
      if (storagePath) {
        let actualImagePath = storagePath;
        if (actualImagePath.startsWith('/home/barun/Documents/home-security-non-docker/data/detections/'))
          actualImagePath = actualImagePath.replace('/home/barun/Documents/home-security-non-docker/data/detections/', '/app/data/detections/');
        const allowedPaths = [path.join(process.cwd(), 'public'), path.join(process.cwd(), '..', 'public'), '/app/data/detections', '/app/public', '/data/detections', '/home/barun/Documents/home-security-non-docker/data/detections'];
        const isAllowed = allowedPaths.some(p => actualImagePath.startsWith(p));
        if (!isAllowed) return res.status(403).json({ success: false, error: 'Unauthorized file access' });
        if (fs.existsSync(actualImagePath)) return res.sendFile(actualImagePath);
      }
    } catch {}

    const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0');
    const ym = `${year}-${month}`;
    const paths = [
      path.join(process.cwd(), 'data', 'detections', ym, 'events', 'motion', filename),
      path.join(process.cwd(), 'data', 'detections', ym, 'events', 'faces', filename),
      path.join(process.cwd(), '..', 'data', 'detections', ym, 'events', 'motion', filename),
      path.join(process.cwd(), '..', 'data', 'detections', ym, 'events', 'faces', filename),
      `/app/data/detections/${ym}/events/motion/${filename}`,
      `/app/data/detections/${ym}/events/faces/${filename}`
    ];
    for (const imagePath of paths) { if (fs.existsSync(imagePath)) return res.sendFile(imagePath); }
    res.status(404).json({ success: false, error: 'Image file not found on disk' });
  } catch (error) {
    console.error('Error serving event image:', error);
    res.status(500).json({ success: false, error: 'Failed to serve image' });
  }
});

router.post('/:id/archive', requireUser, (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const events = inMemoryState.getRecentEvents();
    const eventIndex = events.findIndex(event => event.id === eventId);
    if (eventIndex === -1) return res.status(404).json({ success: false, error: 'Event not found or already archived' });
    res.json({ success: true, message: 'Event archived successfully' });
  } catch (error) {
    console.error(`Error archiving event ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: 'Failed to archive event' });
  }
});

export default router;
