import express from 'express';
import { getLogDatabase } from '../services/logDatabase.js';

const router = express.Router();

// Get logs with filtering and pagination
router.get('/logs', async (req, res) => {
  try {
    const {
      limit = '100',
      offset = '0',
      level,
      source,
      startTime,
      endTime
    } = req.query;

    const logDb = await getLogDatabase();
    const logs = await logDb.getLogs(
      parseInt(limit as string),
      parseInt(offset as string),
      level as string,
      source as string,
      startTime as string,
      endTime as string
    );

    res.json({
      success: true,
      data: logs,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: logs.length
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logs'
    });
  }
});

// Search logs
router.get('/logs/search', async (req, res) => {
  try {
    const { q, limit = '50' } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const logDb = await getLogDatabase();
    const logs = await logDb.searchLogs(
      q as string,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: logs,
      query: q
    });
  } catch (error) {
    console.error('Error searching logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search logs'
    });
  }
});

// Get log statistics
router.get('/logs/stats', async (req, res) => {
  try {
    const logDb = await getLogDatabase();
    const stats = await logDb.getLogStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching log stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch log statistics'
    });
  }
});

// Clean up old logs (admin only)
router.delete('/logs/cleanup', async (req, res) => {
  try {
    const { days = '30' } = req.query;

    const logDb = await getLogDatabase();
    const deletedCount = await logDb.cleanupOldLogs(parseInt(days as string));

    res.json({
      success: true,
      message: `Deleted ${deletedCount} old log entries`,
      deletedCount
    });
  } catch (error) {
    console.error('Error cleaning up logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup logs'
    });
  }
});

export default router;