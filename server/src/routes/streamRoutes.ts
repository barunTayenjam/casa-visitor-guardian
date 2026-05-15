import { Express, Request, Response } from 'express';
import { optionalAuth, requireUser } from '../middleware/auth.js';
import { serviceRegistry } from '../services/serviceRegistry.js';

// Validate cameraId parameter
function validateCameraIdParam(cameraId: string, res: Response): boolean {
  const CAMERA_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
  if (!cameraId || !CAMERA_ID_PATTERN.test(cameraId) || cameraId.length > 100) {
    res.status(400).json({ success: false, error: 'Invalid camera ID format' });
    return false;
  }
  return true;
}

export function configureStreamRoutes(app: Express) {
  // Streaming metrics endpoint
  app.get('/api/streaming/metrics', optionalAuth, (req: Request, res: Response) => {
    try {
      const streamManager = serviceRegistry.getStreamManager();
      const cameras = streamManager.getAllCameras();
      const metrics = cameras.map((camera: any) => ({
        cameraId: camera.id,
        cameraName: camera.name,
        viewerCount: camera.activeViewers?.size || 0,
        adaptiveFps: camera.adaptiveFps || 4,
        isActive: camera.isActive,
        bandwidth: camera.streams.get('live')?.lastFrame?.length || 0,
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
  });

  // Simple JPEG frame endpoint for camera streams
  app.get('/snapshot/:cameraId.jpg', (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;
      if (!validateCameraIdParam(cameraId, res)) return;

      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getAllCameras().find((c: any) => c.id === cameraId);
      if (!camera) return res.status(404).json({ success: false, error: 'Camera not found' });

      const detectStream = camera.streams.get('detect');
      if (!camera.isActive || !detectStream?.lastFrame) {
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
        return res.end(placeholder);
      }

      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': detectStream.lastFrame.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(detectStream.lastFrame);
    } catch (error) {
      console.error(`Error getting snapshot for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get snapshot' });
    }
  });

  // Test MJPEG stream endpoint for debugging
  app.get('/stream/:cameraId/test', (req: Request, res: Response) => {
    try {
      const boundary = '--myboundary';
      res.writeHead(200, {
        'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Connection': 'close',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      let frameCount = 0;
      const interval = setInterval(() => {
        if (!res.writable) { clearInterval(interval); return; }
        const frameBuffer = Buffer.from(`--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: 1000\r\n\r\n${Buffer.alloc(1000, 0).toString('binary')}`);
        try {
          res.write(frameBuffer);
          frameCount++;
          if (frameCount >= 100) { clearInterval(interval); res.write(`--${boundary}--\r\n`); res.end(); }
        } catch { clearInterval(interval); }
      }, 100);
    } catch (error) {
      console.error('Test stream error:', error);
      res.status(500).json({ success: false, error: 'Test stream failed' });
    }
  });

  // MJPEG stream endpoint for live camera feeds
  app.get('/stream/:cameraId', optionalAuth, (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;
      if (!validateCameraIdParam(cameraId, res)) return;

      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getAllCameras().find((c: any) => c.id === cameraId);
      if (!camera) return res.status(404).json({ success: false, error: 'Camera not found' });
      if (!camera.isActive) return res.status(503).json({ success: false, error: 'Camera is not streaming' });

      const boundary = '--myboundary';
      res.writeHead(200, {
        'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Connection': 'close',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      const stream = streamManager.getStream(cameraId, 'detect');
      const process = stream ? stream.process : null;
      const isTestStream = stream && !process;

      if (process && process.stdout && !isTestStream) {
        let isActive = true;
        const writeChunk = (chunk: Buffer) => {
          if (!isActive) return;
          const chunkHeader = `Content-Type: image/jpeg\r\nContent-Length: ${chunk.length}\r\n\r\n`;
          const chunkEnd = `\r\n--${boundary}\r\n`;
          try { res.write(`--${boundary}\r\n`); res.write(chunkHeader); res.write(chunk); res.write(chunkEnd); } catch { isActive = false; }
        };
        process.stdout.on('data', writeChunk);
        req.on('close', () => { isActive = false; try { res.write(`--${boundary}--\r\n`); res.end(); } catch {} });
        req.on('aborted', () => { isActive = false; });
      } else if (isTestStream) {
        let isActive = true;
        const interval = setInterval(() => {
          if (!isActive || !stream.lastFrame) return;
          const frame = stream.lastFrame;
          try {
            res.write(`--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
            res.write(frame);
            res.write(`\r\n--${boundary}\r\n`);
          } catch { isActive = false; clearInterval(interval); }
        }, Math.floor(1000 / (stream.fps || 4)));
        req.on('close', () => { isActive = false; clearInterval(interval); try { res.write(`--${boundary}--\r\n`); res.end(); } catch {} });
        req.on('aborted', () => { isActive = false; clearInterval(interval); });
      } else {
        res.write(`--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: 1000\r\n\r\n`);
        res.write(Buffer.alloc(1000, 0));
        res.write(`\r\n--${boundary}--\r\n`);
        res.end();
      }
    } catch (error) {
      console.error(`Error serving stream for camera ${req.params.cameraId}:`, error);
      if (!res.headersSent) res.status(500).json({ success: false, error: 'Failed to serve stream' });
    }
  });

  // Low-resolution detect stream for OpenCV detection service
  app.get('/api/streams/:cameraId/detect', requireUser, (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;
      if (!validateCameraIdParam(cameraId, res)) return;

      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(cameraId);
      if (!camera) return res.status(404).json({ success: false, error: 'Camera not found' });

      const stream = camera.streams.get('detect');
      if (!stream) return res.status(404).json({ success: false, error: 'Detect stream not configured' });

      if (!stream.isActive) streamManager.startStream(cameraId, 'detect');

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
        if (!isActive || !stream.lastFrame) return;
        const frame = stream.lastFrame;
        try {
          res.write(`--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
          res.write(frame);
          res.write(`\r\n--${boundary}\r\n`);
        } catch { isActive = false; }
      };
      const interval = setInterval(sendFrame, Math.floor(1000 / stream.fps));
      res.write(`--${boundary}\r\n`);
      req.on('close', () => { isActive = false; clearInterval(interval); try { res.write(`--${boundary}--\r\n`); res.end(); } catch {} });
      req.on('aborted', () => { isActive = false; clearInterval(interval); });
    } catch (error) {
      console.error(`Error serving detect stream for camera ${req.params.cameraId}:`, error);
      if (!res.headersSent) res.status(500).json({ success: false, error: 'Failed to serve detect stream' });
    }
  });

  // High-resolution live stream for browser viewing
  app.get('/api/streams/:cameraId/live', optionalAuth, (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;
      if (!validateCameraIdParam(cameraId, res)) return;

      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(cameraId);
      if (!camera) return res.status(404).json({ success: false, error: 'Camera not found' });

      let stream = camera.streams.get('record');
      if (!stream) stream = camera.streams.get('detect');
      if (!stream) return res.status(404).json({ success: false, error: 'No suitable stream found' });

      if (!stream.isActive) streamManager.startStream(cameraId, stream.role);

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
        if (!isActive || !stream?.lastFrame) return;
        const frame = stream.lastFrame;
        try {
          res.write(`--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
          res.write(frame);
          res.write(`\r\n--${boundary}\r\n`);
        } catch { isActive = false; }
      };
      const fps = Math.min(stream.fps, 15);
      const interval = setInterval(sendFrame, Math.floor(1000 / fps));
      res.write(`--${boundary}\r\n`);
      req.on('close', () => { isActive = false; clearInterval(interval); try { res.write(`--${boundary}--\r\n`); res.end(); } catch {} });
      req.on('aborted', () => { isActive = false; clearInterval(interval); });
    } catch (error) {
      console.error(`Error serving live stream for camera ${req.params.cameraId}:`, error);
      if (!res.headersSent) res.status(500).json({ success: false, error: 'Failed to serve live stream' });
    }
  });

  // Single frame endpoint (non-streaming)
  app.get('/api/streams/:cameraId/frame', requireUser, (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;
      if (!validateCameraIdParam(cameraId, res)) return;

      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(cameraId);
      if (!camera) return res.status(404).json({ success: false, error: 'Camera not found' });

      const stream = camera.streams.get('detect');
      if (!stream || !stream.lastFrame) return res.status(503).json({ success: false, error: 'No frame available' });

      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': stream.lastFrame.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(stream.lastFrame);
    } catch (error) {
      console.error(`Error getting frame for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get frame' });
    }
  });

  // Get stream status for a camera
  app.get('/api/streams/:cameraId/status', optionalAuth, (req: Request, res: Response) => {
    try {
      const cameraId = req.params.cameraId;
      if (!validateCameraIdParam(cameraId, res)) return;

      const streamManager = serviceRegistry.getStreamManager();
      const camera = streamManager.getCamera(cameraId);
      if (!camera) return res.status(404).json({ success: false, error: 'Camera not found' });

      const streams: Record<string, any> = {};
      camera.streams.forEach((stream, role) => {
        streams[role] = {
          isActive: stream.isActive,
          fps: stream.fps,
          width: stream.width,
          height: stream.height,
          hasFrame: !!stream.lastFrame,
          frameSize: stream.lastFrame?.length || 0
        };
      });

      res.json({
        success: true,
        cameraId,
        cameraName: camera.name,
        isActive: camera.isActive,
        streams,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error getting stream status for camera ${req.params.cameraId}:`, error);
      res.status(500).json({ success: false, error: 'Failed to get stream status' });
    }
  });
}
