import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { storageStatsService } from '../services/storageStatsService.js';
import { retentionPolicyService } from '../services/retentionPolicyService.js';
import { automatedCleanupService } from '../services/automatedCleanupService.js';

const router = Router();

const updateRetentionSchema = z.object({
  alertsDays: z.number().int().min(0).max(365).optional(),
  detectionsDays: z.number().int().min(0).max(365).optional(),
  previewsDays: z.number().int().min(0).max(365).optional(),
  snapshotsDays: z.number().int().min(0).max(365).optional(),
  eventsDays: z.number().int().min(0).max(365).optional(),
  retainIndefinitely: z.boolean().optional(),
});

const cleanupSchema = z.object({
  camera: z.string().optional(),
  category: z.enum(['alerts', 'detections', 'previews', 'snapshots', 'events']).optional(),
});

router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const globalStats = await storageStatsService.getGlobalStorageStats();
    const projection = await storageStatsService.getStorageProjection(30);
    const cleanupInProgress = automatedCleanupService.isCleanupInProgress();

    res.json({
      success: true,
      data: {
        storage: {
          totalBytes: globalStats.totalBytes,
          totalGB: (globalStats.totalBytes / (1024 * 1024 * 1024)).toFixed(2),
          totalFiles: globalStats.totalFiles,
          percentageUsed: globalStats.percentageUsed.toFixed(2),
          oldestFileDays: globalStats.oldestFileDays,
          breakdown: globalStats.breakdown,
        },
        projection: {
          projectedGB: projection.projectedGB.toFixed(2),
          willExceedCapacity: projection.willExceedCapacity,
          daysUntilFull: projection.daysUntilFull,
        },
        cleanup: {
          inProgress: cleanupInProgress,
        },
      },
    });
  } catch (error) {
    console.error('Error retrieving storage overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve storage overview',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/stats/detailed', async (req: Request, res: Response) => {
  try {
    const { camera, category } = req.query;

    const stats = await storageStatsService.getStorageStats(
      camera as string | undefined,
      category as string | undefined
    );

    const detailedStats = stats.map(stat => ({
      camera: stat.camera || 'global',
      category: stat.category,
      totalBytes: stat.total_bytes,
      totalGB: (stat.total_bytes / (1024 * 1024 * 1024)).toFixed(2),
      fileCount: stat.file_count,
      oldestFileDays: stat.oldest_file_days,
      growthRateMBPerDay: stat.growth_rate_mb_per_day,
      breakdown: stat.breakdown,
      lastCalculatedAt: stat.last_calculated_at,
    }));

    res.json({
      success: true,
      data: detailedStats,
    });
  } catch (error) {
    console.error('Error retrieving detailed storage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve detailed storage stats',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/stats/projection', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    const projection = await storageStatsService.getStorageProjection(days);

    res.json({
      success: true,
      data: {
        projectedBytes: projection.projectedBytes,
        projectedGB: projection.projectedGB.toFixed(2),
        willExceedCapacity: projection.willExceedCapacity,
        daysUntilFull: projection.daysUntilFull,
      },
    });
  } catch (error) {
    console.error('Error calculating storage projection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate storage projection',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/stats/recalculate', async (req: Request, res: Response) => {
  try {
    await storageStatsService.calculateAllStats();

    res.json({
      success: true,
      message: 'Storage statistics recalculation initiated',
    });
  } catch (error) {
    console.error('Error recalculating storage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to recalculate storage statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/retention/policies', async (req: Request, res: Response) => {
  try {
    const policies = await retentionPolicyService.getAllPolicies();

    const policyData = policies.map(policy => ({
      camera: policy.camera || 'global',
      alertsDays: policy.alerts_days,
      detectionsDays: policy.detections_days,
      previewsDays: policy.previews_days,
      snapshotsDays: policy.snapshots_days,
      eventsDays: policy.events_days,
      retainIndefinitely: policy.retain_indefinitely,
      createdAt: policy.created_at,
      updatedAt: policy.updated_at,
    }));

    res.json({
      success: true,
      data: policyData,
    });
  } catch (error) {
    console.error('Error retrieving retention policies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve retention policies',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/retention/policies/:camera', async (req: Request, res: Response) => {
  try {
    const { camera } = req.params;

    const policy = await retentionPolicyService.getPolicy(camera);

    res.json({
      success: true,
      data: {
        camera: policy.camera || 'global',
        alertsDays: policy.alerts_days,
        detectionsDays: policy.detections_days,
        previewsDays: policy.previews_days,
        snapshotsDays: policy.snapshots_days,
        eventsDays: policy.events_days,
        retainIndefinitely: policy.retain_indefinitely,
        createdAt: policy.created_at,
        updatedAt: policy.updated_at,
      },
    });
  } catch (error) {
    console.error(`Error retrieving retention policy for ${req.params.camera}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve retention policy',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.put('/retention/policies/:camera', async (req: Request, res: Response) => {
  try {
    const { camera } = req.params;

    const validationResult = updateRetentionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validationResult.error.errors,
      });
    }

    const policy = await retentionPolicyService.updatePolicy(
      camera === 'global' ? null : camera,
      validationResult.data
    );

    res.json({
      success: true,
      message: 'Retention policy updated successfully',
      data: {
        camera: policy.camera || 'global',
        alertsDays: policy.alerts_days,
        detectionsDays: policy.detections_days,
        previewsDays: policy.previews_days,
        snapshotsDays: policy.snapshots_days,
        eventsDays: policy.events_days,
        retainIndefinitely: policy.retain_indefinitely,
        updatedAt: policy.updated_at,
      },
    });
  } catch (error) {
    console.error(`Error updating retention policy for ${req.params.camera}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update retention policy',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.delete('/retention/policies/:camera', async (req: Request, res: Response) => {
  try {
    const { camera } = req.params;

    if (camera === 'global') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete global retention policy',
      });
    }

    await retentionPolicyService.deletePolicy(camera);

    res.json({
      success: true,
      message: `Retention policy for ${camera} deleted successfully`,
    });
  } catch (error) {
    console.error(`Error deleting retention policy for ${req.params.camera}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete retention policy',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/retention/summary', async (req: Request, res: Response) => {
  try {
    const { camera } = req.query;

    const summary = await retentionPolicyService.getRetentionSummary(
      camera as string | undefined
    );

    res.json({
      success: true,
      data: {
        camera: summary.policy.camera || 'global',
        policy: {
          alertsDays: summary.policy.alerts_days,
          detectionsDays: summary.policy.detections_days,
          previewsDays: summary.policy.previews_days,
          snapshotsDays: summary.policy.snapshots_days,
          eventsDays: summary.policy.events_days,
          retainIndefinitely: summary.policy.retain_indefinitely,
        },
        expiredFiles: summary.expiredCounts,
        totalExpiredFiles: summary.totalExpiredFiles,
      },
    });
  } catch (error) {
    console.error('Error retrieving retention summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve retention summary',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/cleanup/run', async (req: Request, res: Response) => {
  try {
    const validationResult = cleanupSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validationResult.error.errors,
      });
    }

    const result = await automatedCleanupService.runManualCleanup(
      validationResult.data.camera,
      validationResult.data.category
    );

    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      data: {
        camera: result.camera || 'global',
        category: result.category || 'all',
        deletedFiles: result.deletedFiles,
        freedBytes: result.freedBytes,
        freedMB: (result.freedBytes / (1024 * 1024)).toFixed(2),
        timestamp: result.timestamp,
      },
    });
  } catch (error) {
    console.error('Error running cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run cleanup',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/cleanup/status', async (req: Request, res: Response) => {
  try {
    const inProgress = automatedCleanupService.isCleanupInProgress();
    const history = await automatedCleanupService.getCleanupHistory(20);
    const stats = await automatedCleanupService.getCleanupStats();

    res.json({
      success: true,
      data: {
        inProgress,
        history: history.map(h => ({
          camera: h.camera || 'global',
          category: h.category || 'all',
          deletedFiles: h.deletedFiles,
          freedBytes: h.freedBytes,
          freedMB: (h.freedBytes / (1024 * 1024)).toFixed(2),
          timestamp: h.timestamp,
        })),
        stats: {
          lastCleanupTime: stats.lastCleanupTime,
          totalCleanupRuns: stats.totalCleanupRuns,
          totalFilesDeleted: stats.totalFilesDeleted,
          totalBytesFreed: stats.totalBytesFreed,
          totalMBFreed: (stats.totalBytesFreed / (1024 * 1024)).toFixed(2),
          totalEventsDeleted: stats.totalEventsDeleted,
          averageCleanupTime: stats.averageCleanupTime,
        },
      },
    });
  } catch (error) {
    console.error('Error retrieving cleanup status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cleanup status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/retention/apply', async (req: Request, res: Response) => {
  try {
    const validationResult = cleanupSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validationResult.error.errors,
      });
    }

    const deletedCount = await retentionPolicyService.applyRetentionPolicy(
      validationResult.data.camera,
      validationResult.data.category
    );

    res.json({
      success: true,
      message: 'Retention policy applied successfully',
      data: {
        camera: validationResult.data.camera || 'global',
        category: validationResult.data.category || 'all',
        deletedFiles: deletedCount,
      },
    });
  } catch (error) {
    console.error('Error applying retention policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply retention policy',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/health', async (req: Request, res: Response) => {
  try {
    const statsInitialized = storageStatsService.isInitialized();
    const retentionInitialized = retentionPolicyService.isInitialized();
    const cleanupInitialized = automatedCleanupService.isInitialized();
    const cleanupInProgress = automatedCleanupService.isCleanupInProgress();

    const globalStats = await storageStatsService.getGlobalStorageStats();
    const maxStorageGB = 100;

    const storageHealth = {
      percentageUsed: globalStats.percentageUsed,
      status: globalStats.percentageUsed < 80 ? 'healthy' : globalStats.percentageUsed < 90 ? 'warning' : 'critical',
    };

    res.json({
      success: true,
      data: {
        services: {
          storageStats: statsInitialized ? 'initialized' : 'not initialized',
          retentionPolicy: retentionInitialized ? 'initialized' : 'not initialized',
          automatedCleanup: cleanupInitialized ? 'initialized' : 'not initialized',
        },
        storage: storageHealth,
        cleanup: {
          inProgress: cleanupInProgress,
        },
      },
    });
  } catch (error) {
    console.error('Error retrieving storage health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve storage health',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
