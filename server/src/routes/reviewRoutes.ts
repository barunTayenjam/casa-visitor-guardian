import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate.js';
import { ReviewService } from '../services/review/ReviewService.js';
import { PreviewService } from '../services/preview/PreviewService.js';

const router = Router();

const ReviewQuerySchema = z.object({
  camera: z.string().optional(),
  after: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
  severity: z.enum(['alert', 'detection']).optional(),
  labels: z.string().optional(),
  reviewed: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
});

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const query = ReviewQuerySchema.parse(req.query);
    const userId = (req as AuthenticatedRequest).user?.id;
    const result = await ReviewService.getReviewSegments({
      ...query,
      after: query.after ? new Date(query.after) : undefined,
      before: query.before ? new Date(query.before) : undefined,
      labels: query.labels ? query.labels.split(',') : undefined,
      userId,
    });

    const segmentsWithReviewStatus = await Promise.all(
      result.segments.map(async (segment) => ({
        ...segment,
        reviewed: userId ? await ReviewService.getSegmentReviewStatus(segment.id, userId) : false,
      }))
    );

    res.json({ success: true, data: { ...result, segments: segmentsWithReviewStatus } });
  } catch (err) {
    console.error('Get review segments error:', err);
    res.status(500).json({ success: false, error: 'Failed to get review segments' });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const segment = await ReviewService.getReviewSegment(req.params.id);
    if (!segment) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }

    const userId = (req as AuthenticatedRequest).user?.id;
    const reviewed = userId ? await ReviewService.getSegmentReviewStatus(segment.id, userId) : false;

    res.json({ success: true, data: { ...segment, reviewed } });
  } catch (err) {
    console.error('Get review segment error:', err);
    res.status(500).json({ success: false, error: 'Failed to get review segment' });
  }
});

router.get('/:id/thumbnail.jpg', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const camera = id.split('_')[2];
    const thumbnailPath = await PreviewService.getThumbnailPath(id, camera);

    if (!thumbnailPath) {
      return res.status(404).json({ success: false, error: 'Thumbnail not found' });
    }

    res.sendFile(thumbnailPath);
  } catch (err) {
    console.error('Get thumbnail error:', err);
    res.status(500).json({ success: false, error: 'Failed to get thumbnail' });
  }
});

router.get('/:id/preview.mp4', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const camera = id.split('_')[2];
    const preview = await PreviewService.getPreviewStream(id, camera);

    if (!preview) {
      return res.status(404).json({ success: false, error: 'Preview not found' });
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', preview.length);
    res.send(preview);
  } catch (err) {
    console.error('Get preview error:', err);
    res.status(500).json({ success: false, error: 'Failed to get preview' });
  }
});

router.post('/:id/acknowledge', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    await ReviewService.acknowledgeSegment(req.params.id, userId);
    res.json({ success: true, message: 'Segment acknowledged' });
  } catch (err) {
    console.error('Acknowledge segment error:', err);
    res.status(500).json({ success: false, error: 'Failed to acknowledge segment' });
  }
});

router.post('/generate/:camera', authenticate, async (req: Request, res: Response) => {
  try {
    await ReviewService.generateReviewSegments(req.params.camera);
    res.json({ success: true, message: 'Review segments generated' });
  } catch (err) {
    console.error('Generate review segments error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate review segments' });
  }
});

export function configureReviewRoutes(app: any): void {
  app.use('/api/review', router);
}

export default router;
