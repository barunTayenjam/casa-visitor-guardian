import { Router, Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { logger } from '../utils/logger.js';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { imageFileService } from '../services/imageFileService.js';

const imageHeaders = (res: Response, filepath: string) => {
  if (filepath.endsWith('.jpg') || filepath.endsWith('.jpeg') || filepath.endsWith('.png')) {
    res.setHeader('Content-Type', 'image/jpeg');
  }
};

export const staticRoutes = Router();

staticRoutes.get('/events/:filename', async (req: Request, res: Response) => {
  const filename = req.params.filename;

  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ success: false, error: 'Invalid filename' });
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return res.status(400).json({ success: false, error: 'Invalid filename' });
  }

  try {
    const imagePath = await imageFileService.resolveImage(filename, {
      fileTypes: ['event_face', 'event_motion'],
      fallbackSubDir: 'events/motion',
    });

    if (imagePath) {
      return res.sendFile(imagePath);
    }

    return res.status(404).json({ success: false, error: 'Image not found' });
  } catch (error) {
    logger.error('Error serving event image', 'StaticRoutes', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

staticRoutes.get('/snapshots/:filename', async (req: Request, res: Response) => {
  const filename = req.params.filename;

  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ success: false, error: 'Invalid filename' });
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return res.status(400).json({ success: false, error: 'Invalid filename' });
  }

  try {
    const imagePath = await imageFileService.resolveImage(filename, {
      fileTypes: ['snapshot'],
      fallbackSubDir: 'snapshots',
    });

    if (imagePath) {
      return res.sendFile(imagePath);
    }

    return res.status(404).json({ success: false, error: 'Image not found' });
  } catch (error) {
    logger.error('Error serving snapshot image', 'StaticRoutes', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

staticRoutes.use('/events', express.static(path.join(process.cwd(), 'data/detections'), {
  maxAge: '1d',
  setHeaders: imageHeaders,
}));

staticRoutes.use('/snapshots', express.static(path.join(process.cwd(), 'public/snapshots'), {
  maxAge: '1d',
  setHeaders: imageHeaders,
}));

staticRoutes.use('/public', express.static('public'));

const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  staticRoutes.use(express.static(distPath));
} else {
  logger.info(`Frontend dist directory not found at ${distPath}, skipping static file serving`, 'StaticRoutes');
}

staticRoutes.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

staticRoutes.get('/health/ready', (_req, res) => {
  const services: Record<string, boolean> = {};

  try {
    const dataSource = serviceRegistry.getAppDataSource();
    services.database = dataSource.isInitialized;
  } catch {
    services.database = false;
  }

  try {
    serviceRegistry.getStreamManager();
    services.streamManager = true;
  } catch {
    services.streamManager = false;
  }

  try {
    const pythonWs = serviceRegistry.getPythonWsClient();
    services.pythonWs = pythonWs.connected;
  } catch {
    services.pythonWs = false;
  }

  const criticalReady = services.database && services.streamManager;

  res.status(criticalReady ? 200 : 503).json({
    status: criticalReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    services
  });
});

staticRoutes.get('/api/streams/health', (_req, res) => {
  try {
    const streamManager = serviceRegistry.getStreamManager();
    if (!streamManager.healthMonitor) {
      return res.status(503).json({
        success: false,
        error: 'Stream manager not available'
      });
    }

    const healthStatus = streamManager.healthMonitor.getHealthStatus();
    const now = Date.now();

    const cameraHealth = healthStatus.map(({ key, status }) => {
      const timeSinceLastFrame = status.lastFrameTime > 0 ? now - status.lastFrameTime : null;
      const isStale = timeSinceLastFrame !== null && timeSinceLastFrame > 120000;

      return {
        cameraId: status.cameraId,
        role: status.role,
        isActive: status.isActive,
        lastFrameTime: status.lastFrameTime > 0 ? new Date(status.lastFrameTime).toISOString() : null,
        secondsSinceLastFrame: timeSinceLastFrame !== null ? Math.floor(timeSinceLastFrame / 1000) : null,
        isStale,
        restartAttempts: status.restartAttempts,
        lastRestartTime: status.lastRestartTime > 0 ? new Date(status.lastRestartTime).toISOString() : null
      };
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalStreams: cameraHealth.length,
      activeStreams: cameraHealth.filter(h => h.isActive).length,
      staleStreams: cameraHealth.filter(h => h.isStale).length,
      streams: cameraHealth
    });
  } catch (error) {
    logger.error('Error in stream health endpoint', 'StaticRoutes', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
