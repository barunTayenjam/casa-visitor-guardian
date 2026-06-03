import { logger } from '../utils/logger.js';
import { Request, Response } from 'express';
import { BaseController } from './BaseController.js';
import { serviceRegistry } from '../services/serviceRegistry.js';

export class StreamController extends BaseController {
  getMetrics(req: Request, res: Response): void {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const cameras = streamManager.getAllCameras();
      const metrics = cameras.map((camera: any) => ({
        cameraId: camera.id,
        cameraName: camera.name,
        viewerCount: camera.activeViewers?.size || 0,
        adaptiveFps: camera.adaptiveFps || 4,
        isActive: camera.isActive,
        bandwidth: camera.lastFrame?.length || 0,
        fps: camera.adaptiveFps || 4,
      }));

      res.json({
        success: true,
        metrics,
        totalViewers: metrics.reduce((sum: number, m: any) => sum + m.viewerCount, 0),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get streaming metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  getSnapshot(req: Request, res: Response): void {
    const cameraId = req.params.cameraId;
    if (!cameraId || !/^[a-zA-Z0-9_-]+$/.test(cameraId) || cameraId.length > 100) {
      res.status(400).json({ success: false, error: 'Invalid camera ID format' });
      return;
    }

    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getAllCameras().find((c: any) => c.id === cameraId);
      if (!camera) { res.status(404).json({ success: false, error: 'Camera not found' }); return; }

      if (!camera.isActive || !camera.lastFrame) {
        const placeholder = Buffer.from([
          0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
          0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43
        ]);
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Length': placeholder.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        });
        res.end(placeholder);
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': camera.lastFrame.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(camera.lastFrame);
    } catch (error) {
       logger.error(`Error getting snapshot for camera ${cameraId}`, 'Stream', error);
      res.status(500).json({ success: false, error: 'Failed to get snapshot' });
    }
  }

  getMjpegStream(req: Request, res: Response): void {
    const cameraId = req.params.cameraId;
    if (!cameraId || !/^[a-zA-Z0-9_-]+$/.test(cameraId) || cameraId.length > 100) {
      res.status(400).json({ success: false, error: 'Invalid camera ID format' });
      return;
    }

    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getAllCameras().find((c: any) => c.id === cameraId);
      if (!camera) { res.status(404).json({ success: false, error: 'Camera not found' }); return; }
      if (!camera.isActive) { res.status(503).json({ success: false, error: 'Camera is not streaming' }); return; }

      const boundary = '--myboundary';
      res.writeHead(200, {
        'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Connection': 'close',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      let isActive = true;
      const sendFrame = () => {
        if (!isActive || !camera.lastFrame) return;
        const frame = camera.lastFrame;
        try {
          res.write(`--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
          res.write(frame);
          res.write(`\r\n--${boundary}\r\n`);
        } catch { isActive = false; }
      };
      const interval = setInterval(sendFrame, 250);
      res.write(`--${boundary}\r\n`);
      req.on('close', () => { isActive = false; clearInterval(interval); try { res.write(`--${boundary}--\r\n`); res.end(); } catch {} });
      req.on('aborted', () => { isActive = false; clearInterval(interval); });
    } catch (error) {
       logger.error(`Error serving stream for camera ${cameraId}`, 'Stream', error);
      if (!res.headersSent) res.status(500).json({ success: false, error: 'Failed to serve stream' });
    }
  }

  getDetectStream(req: Request, res: Response): void {
    const cameraId = req.params.cameraId;
    if (!cameraId || !/^[a-zA-Z0-9_-]+$/.test(cameraId) || cameraId.length > 100) {
      res.status(400).json({ success: false, error: 'Invalid camera ID format' });
      return;
    }

    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(cameraId);
      if (!camera) { res.status(404).json({ success: false, error: 'Camera not found' }); return; }

      if (!camera.isActive) streamManager.startStream(cameraId, 'live');

      const boundary = '--myboundary';
      res.writeHead(200, {
        'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Connection': 'close',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      let isActive = true;
      const sendFrame = () => {
        if (!isActive || !camera.lastFrame) return;
        const frame = camera.lastFrame;
        try {
          res.write(`--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
          res.write(frame);
          res.write(`\r\n--${boundary}\r\n`);
        } catch { isActive = false; }
      };
      const interval = setInterval(sendFrame, 250);
      res.write(`--${boundary}\r\n`);
      req.on('close', () => { isActive = false; clearInterval(interval); try { res.write(`--${boundary}--\r\n`); res.end(); } catch {} });
      req.on('aborted', () => { isActive = false; clearInterval(interval); });
    } catch (error) {
       logger.error(`Error serving detect stream for camera ${cameraId}`, 'Stream', error);
      if (!res.headersSent) res.status(500).json({ success: false, error: 'Failed to serve detect stream' });
    }
  }

  getLiveStream(req: Request, res: Response): void {
    const cameraId = req.params.cameraId;
    if (!cameraId || !/^[a-zA-Z0-9_-]+$/.test(cameraId) || cameraId.length > 100) {
      res.status(400).json({ success: false, error: 'Invalid camera ID format' });
      return;
    }

    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(cameraId);
      if (!camera) { res.status(404).json({ success: false, error: 'Camera not found' }); return; }

      if (!camera.isActive) streamManager.startStream(cameraId, 'live');

      const boundary = '--myboundary';
      res.writeHead(200, {
        'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Connection': 'close',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      let isActive = true;
      const sendFrame = () => {
        if (!isActive || !camera.lastFrame) return;
        const frame = camera.lastFrame;
        try {
          res.write(`--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
          res.write(frame);
          res.write(`\r\n--${boundary}\r\n`);
        } catch { isActive = false; }
      };
      const interval = setInterval(sendFrame, 250);
      res.write(`--${boundary}\r\n`);
      req.on('close', () => { isActive = false; clearInterval(interval); try { res.write(`--${boundary}--\r\n`); res.end(); } catch {} });
      req.on('aborted', () => { isActive = false; clearInterval(interval); });
    } catch (error) {
       logger.error(`Error serving live stream for camera ${cameraId}`, 'Stream', error);
      if (!res.headersSent) res.status(500).json({ success: false, error: 'Failed to serve live stream' });
    }
  }

  getFrame(req: Request, res: Response): void {
    const cameraId = req.params.cameraId;
    if (!cameraId || !/^[a-zA-Z0-9_-]+$/.test(cameraId) || cameraId.length > 100) {
      res.status(400).json({ success: false, error: 'Invalid camera ID format' });
      return;
    }

    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(cameraId);
      if (!camera) { res.status(404).json({ success: false, error: 'Camera not found' }); return; }

      if (!camera.lastFrame) { res.status(503).json({ success: false, error: 'No frame available' }); return; }

      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': camera.lastFrame.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(camera.lastFrame);
    } catch (error) {
       logger.error(`Error getting frame for camera ${cameraId}`, 'Stream', error);
      res.status(500).json({ success: false, error: 'Failed to get frame' });
    }
  }

  getStreamStatus(req: Request, res: Response): void {
    const cameraId = req.params.cameraId;
    if (!cameraId || !/^[a-zA-Z0-9_-]+$/.test(cameraId) || cameraId.length > 100) {
      res.status(400).json({ success: false, error: 'Invalid camera ID format' });
      return;
    }

    try {
      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(cameraId);
      if (!camera) { res.status(404).json({ success: false, error: 'Camera not found' }); return; }

      const streams = {
        live: {
          isActive: camera.isActive,
          fps: camera.adaptiveFps || 4,
          hasFrame: !!camera.lastFrame,
          frameSize: camera.lastFrame?.length || 0
        }
      };

      res.json({
        success: true,
        cameraId,
        cameraName: camera.name,
        isActive: camera.isActive,
        streams,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
       logger.error(`Error getting stream status for camera ${cameraId}`, 'Stream', error);
      res.status(500).json({ success: false, error: 'Failed to get stream status' });
    }
  }
}

export const streamController = new StreamController();
