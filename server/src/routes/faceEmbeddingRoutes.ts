import { logger } from '../utils/logger.js';
import express from 'express';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../middleware/zodValidation.js';
import { AppDataSource } from '../database.js';
import { FaceEmbedding } from '../models/FaceEmbedding.js';
import { requireUser, optionalAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(optionalAuth);
router.post('/', requireUser);
router.delete('/:id', requireUser);
const faceEmbeddingRepository = AppDataSource.getRepository(FaceEmbedding);

const createEmbeddingSchema = z.object({
  visitorId: z.string().min(1),
  embeddingVector: z.array(z.number()).refine(v => [128, 512].includes(v.length), 'Embedding vector must be 128 or 512-dimensional'),
  qualityScore: z.number().optional(),
  cameraId: z.string().optional(),
  embeddingVersion: z.enum(['128', '512']).optional(),
  sharpness: z.number().optional(),
  brightness: z.number().optional(),
  faceWidth: z.number().optional(),
  faceHeight: z.number().optional(),
  faceArea: z.number().optional(),
  faceConfidence: z.number().optional(),
  imagePath: z.string().optional(),
  detectionMethod: z.string().optional()
});

const visitorEmbeddingsParamsSchema = z.object({
  visitorId: z.string().min(1)
});

const visitorEmbeddingsQuerySchema = z.object({
  minQuality: z.preprocess(v => (v ? parseFloat(v as string) : undefined), z.number().min(0).max(100).optional()),
  version: z.enum(['128', '512']).optional()
});

const highQualityQuerySchema = z.object({
  visitorId: z.string().optional(),
  minQuality: z.preprocess(v => (v ? parseFloat(v as string) : undefined), z.number().min(0).max(100).optional()),
  limit: z.preprocess(v => (v ? parseInt(v as string, 10) : undefined), z.number().min(1).max(50).optional())
});

const deleteEmbeddingParamsSchema = z.object({
  id: z.string().min(1)
});

// POST /api/face-embeddings - Store new embedding with quality metadata
router.post('/', validateBody(createEmbeddingSchema), async (req, res) => {
  try {
    const {
      visitorId,
      embeddingVector,
      qualityScore,
      sharpness,
      brightness,
      faceWidth,
      faceHeight,
      faceArea,
      faceConfidence,
      cameraId,
      imagePath,
      detectionMethod,
      embeddingVersion = '512'
    } = req.body;

    // Create embedding record
    const embedding = faceEmbeddingRepository.create({
      visitorId,
      embeddingVector,
      qualityScore,
      sharpness,
      brightness,
      faceWidth,
      faceHeight,
      faceArea,
      faceConfidence,
      cameraId,
      imagePath,
      detectionMethod,
      embeddingVersion
    });

    await faceEmbeddingRepository.save(embedding);

    res.status(201).json({
      id: embedding.id,
      message: 'Embedding stored successfully',
      qualityScore: embedding.qualityScore
    });
  } catch (error) {
     logger.error('Error storing embedding', 'Face', error);
    res.status(500).json({ error: 'Failed to store embedding' });
  }
});

// GET /api/face-embeddings/visitor/:visitorId - Get all embeddings for a visitor
router.get('/visitor/:visitorId', validateParams(visitorEmbeddingsParamsSchema), validateQuery(visitorEmbeddingsQuerySchema), async (req, res) => {
  try {
    const { visitorId } = req.params;
    const { minQuality = 50, version } = req.query as any;

    const whereClause: Record<string, unknown> = {
      visitorId,
      isActive: true
    };

    if (version) {
      whereClause.embeddingVersion = version as string;
    }

    const embeddings = await faceEmbeddingRepository.find({
      where: whereClause,
      order: {
        qualityScore: 'DESC'
      }
    });

    // Filter by minimum quality
    const filtered = embeddings.filter(
      e => e.qualityScore >= parseFloat(minQuality as string)
    );

    res.json({
      visitorId,
      count: filtered.length,
      embeddings: filtered.map(e => ({
        id: e.id,
        qualityScore: e.qualityScore,
        sharpness: e.sharpness,
        brightness: e.brightness,
        faceSize: { width: e.faceWidth, height: e.faceHeight },
        cameraId: e.cameraId,
        imagePath: e.imagePath,
        createdAt: e.createdAt
      }))
    });
  } catch (error) {
     logger.error('Error fetching embeddings', 'Face', error);
    res.status(500).json({ error: 'Failed to fetch embeddings' });
  }
});

// GET /api/face-embeddings/high-quality - Get high-quality embeddings for recognition
router.get('/high-quality', validateQuery(highQualityQuerySchema), async (req, res) => {
  try {
    const { visitorId, minQuality = 70, limit = 10 } = req.query as any;

    const queryBuilder = faceEmbeddingRepository.createQueryBuilder('fe')
      .where('fe.isActive = :isActive', { isActive: true })
      .andWhere('fe.qualityScore >= :minQuality', { minQuality: parseFloat(minQuality as string) })
      .orderBy('fe.qualityScore', 'DESC')
      .limit(parseInt(limit as string));

    if (visitorId) {
      queryBuilder.andWhere('fe.visitorId = :visitorId', { visitorId });
    }

    const embeddings = await queryBuilder.getMany();

    res.json({
      count: embeddings.length,
      embeddings: embeddings.map(e => ({
        id: e.id,
        visitorId: e.visitorId,
        embeddingVector: e.embeddingVector,
        qualityScore: e.qualityScore,
        cameraId: e.cameraId
      }))
    });
  } catch (error) {
     logger.error('Error fetching high-quality embeddings', 'Face', error);
    res.status(500).json({ error: 'Failed to fetch embeddings' });
  }
});

// DELETE /api/face-embeddings/:id - Soft delete an embedding
router.delete('/:id', validateParams(deleteEmbeddingParamsSchema), async (req, res) => {
  try {
    const { id } = req.params;

    const embedding = await faceEmbeddingRepository.findOne({ where: { id } });
    if (!embedding) {
      return res.status(404).json({ error: 'Embedding not found' });
    }

    embedding.isActive = false;
    await faceEmbeddingRepository.save(embedding);

    res.json({ message: 'Embedding deactivated successfully' });
  } catch (error) {
     logger.error('Error deactivating embedding', 'Face', error);
    res.status(500).json({ error: 'Failed to deactivate embedding' });
  }
});

// GET /api/face-embeddings/stats - Get embedding statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await faceEmbeddingRepository.createQueryBuilder('fe')
      .select('COUNT(fe.id)', 'totalEmbeddings')
      .addSelect('COUNT(DISTINCT fe.visitorId)', 'totalVisitors')
      .addSelect('AVG(fe.qualityScore)', 'avgQualityScore')
      .addSelect('MIN(fe.qualityScore)', 'minQualityScore')
      .addSelect('MAX(fe.qualityScore)', 'maxQualityScore')
      .where('fe.isActive = :isActive', { isActive: true })
      .getRawOne();

    res.json(stats);
  } catch (error) {
     logger.error('Error fetching stats', 'Face', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
