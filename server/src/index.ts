// Server startup
import express from 'express';
import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import configuration
import { config } from './config/index.js';

import { configureRoutes } from './routes/index.js';
import { configureAuthRoutes } from './routes/auth.js';
import { configureVisitorRoutes } from './routes/visitorRoutes.js';
import { setupRTSPStreams } from './streams/rtspManager.js';
import { initializeDatabase } from './database.js';
import { setupOptimizedMotionDetection } from './detection/optimizedMotionDetection.js';
import { consolidatedDetectionService } from './detection/consolidatedDetectionService.js';

dotenv.config({ path: './.env' });

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:5173', 'http://192.168.31.99:5173', 'http://192.168.31.99:8082'],
  credentials: true
}));
app.use(express.json());

// Serve events from data directory with scanning fallback
app.get('/events/:filename', async (req, res) => {
  const filename = req.params.filename;

  try {
    // First, try to query database to get storage path for this filename
    const AppDataSource = (global as any).AppDataSource;
    let results = [];

    if (AppDataSource) {
      try {
        const query = `
          SELECT storage_path
          FROM detection_files
          WHERE original_filename = $1
            AND (file_type = 'event' OR file_type = 'motion')
            AND is_deleted = FALSE
          ORDER BY created_at DESC
          LIMIT 1
        `;

        results = await AppDataSource.query(query, [filename]);
      } catch (dbError) {
        console.warn('Database query failed, falling back to file system scan:', dbError.message);
      }
    }

    if (results.length === 0) {
      // If not found in database or DB unavailable, try scanning across year-month directories
      const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - i); // Last 5 years

      for (const year of years) {
        for (let month = 12; month >= 1; month--) {
          const monthStr = month.toString().padStart(2, '0');
          const directPath = path.join(process.cwd(), 'data', 'detections', `${year}-${monthStr}`, 'events', 'motion', filename);

          if (fs.existsSync(directPath)) {
            return res.sendFile(directPath);
          }
        }
      }

      // If still not found, try direct path in current month
      const currentYear = new Date().getFullYear();
      const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const directPath = path.join(process.cwd(), 'data', 'detections', `${currentYear}-${currentMonth}`, 'events', 'motion', filename);

      if (fs.existsSync(directPath)) {
        return res.sendFile(directPath);
      }

      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    let imagePath = results[0].storage_path;

    // If the path is relative, resolve it relative to the data directory
    if (!path.isAbsolute(imagePath)) {
      imagePath = path.join(process.cwd(), 'data', 'detections', imagePath);
    }

    if (fs.existsSync(imagePath)) {
      res.sendFile(imagePath);
    } else {
      // If file doesn't exist at the stored path, try scanning fallback
      const currentYear = new Date().getFullYear();
      const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const fallbackPath = path.join(process.cwd(), 'data', 'detections', `${currentYear}-${currentMonth}`, 'events', 'motion', filename);

      if (fs.existsSync(fallbackPath)) {
        res.sendFile(fallbackPath);
      } else {
        res.status(404).json({ success: false, error: 'Image file not found at stored path' });
      }
    }
  } catch (error) {
    console.error('Error serving event image:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Serve snapshots from data directory with scanning fallback
app.get('/snapshots/:filename', async (req, res) => {
  const filename = req.params.filename;

  try {
    // First, try to query database to get storage path for this filename
    const AppDataSource = (global as any).AppDataSource;
    let results = [];

    if (AppDataSource) {
      try {
        const query = `
          SELECT storage_path
          FROM detection_files
          WHERE original_filename = $1
            AND file_type = 'snapshot'
            AND is_deleted = FALSE
          ORDER BY created_at DESC
          LIMIT 1
        `;

        results = await AppDataSource.query(query, [filename]);
      } catch (dbError) {
        console.warn('Database query failed, falling back to file system scan:', dbError.message);
      }
    }

    if (results.length === 0) {
      // If not found in database or DB unavailable, try scanning across year-month directories
      const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - i); // Last 5 years

      for (const year of years) {
        for (let month = 12; month >= 1; month--) {
          const monthStr = month.toString().padStart(2, '0');
          const directPath = path.join(process.cwd(), 'data', 'detections', `${year}-${monthStr}`, 'snapshots', filename);

          if (fs.existsSync(directPath)) {
            return res.sendFile(directPath);
          }
        }
      }

      // If still not found, try direct path in current month
      const currentYear = new Date().getFullYear();
      const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const directPath = path.join(process.cwd(), 'data', 'detections', `${currentYear}-${currentMonth}`, 'snapshots', filename);

      if (fs.existsSync(directPath)) {
        return res.sendFile(directPath);
      }

      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    let imagePath = results[0].storage_path;

    // If the path is relative, resolve it relative to the data directory
    if (!path.isAbsolute(imagePath)) {
      imagePath = path.join(process.cwd(), 'data', 'detections', imagePath);
    }

    if (fs.existsSync(imagePath)) {
      res.sendFile(imagePath);
    } else {
      // If file doesn't exist at the stored path, try scanning fallback
      const currentYear = new Date().getFullYear();
      const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const fallbackPath = path.join(process.cwd(), 'data', 'detections', `${currentYear}-${currentMonth}`, 'snapshots', filename);

      if (fs.existsSync(fallbackPath)) {
        res.sendFile(fallbackPath);
      } else {
        res.status(404).json({ success: false, error: 'Image file not found at stored path' });
      }
    }
  } catch (error) {
    console.error('Error serving snapshot image:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Serve images from detections directory (where motion events are actually stored)
app.use('/events', express.static(path.join(process.cwd(), 'data/detections'), {
  maxAge: '1d',
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.jpg') || filepath.endsWith('.jpeg') || filepath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
  }
}));

app.use('/snapshots', express.static(path.join(process.cwd(), 'public/snapshots'), {
  maxAge: '1d',
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.jpg') || filepath.endsWith('.jpeg') || filepath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
  }
}));

app.use('/public', express.static('public'));

// Serve frontend static files
const distPath = path.join(process.cwd(), 'dist'); // Use relative path for both container and local
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  console.log(`Frontend dist directory not found at ${distPath}, skipping static file serving`);
}


// Create HTTP server
const server = http.createServer(app);

// Configure Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:5173', 'http://192.168.31.99:5173', 'http://192.168.31.99:8082'],
    credentials: true
  }
});

// Basic routes - with debugging
app.get('/health', (req, res) => {
  console.log('=== HEALTH ENDPOINT START ===');
  console.log('1. Request received');
  try {
    console.log('2. About to send response');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
    console.log('3. Response sent');
  } catch (error) {
    console.error('4. Error in health endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
  console.log('=== HEALTH ENDPOINT END ===');
});

// Test endpoint
app.get('/test', (req, res) => {
  console.log('=== TEST ENDPOINT START ===');
  try {
    res.json({ message: 'Test successful' });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
  console.log('=== TEST ENDPOINT END ===');
});

// Configure routes first
configureAuthRoutes(app);
configureRoutes(app, io);
configureVisitorRoutes(app);
console.log('Routes configured successfully');

// For any other route, serve the index.html - temporarily disabled
// app.get('*', (req, res) => {
//     res.sendFile(path.join(distPath, 'index.html'));
// });

// Initialize stream manager
async function initializeServices() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');

    // Store AppDataSource in global for use in image serving routes
    const AppDataSource = (global as any).AppDataSource;
    if (AppDataSource) {
      (global as any).AppDataSource = AppDataSource;
    }

// Initialize consolidated detection service
        console.log('Initializing consolidated detection service...');
        const detectionStatus = await consolidatedDetectionService.getServiceStatus();
        if (detectionStatus.available) {
          console.log(`Detection service available at ${detectionStatus.url} (${detectionStatus.responseTime}ms)`);
          (global as any).detectionService = consolidatedDetectionService;
        } else {
          console.warn('Detection service not available, using stub detection');
        }

    console.log('Initializing stream manager...');
    (global as any).streamManager = await setupRTSPStreams(io);
    console.log('Stream manager initialized successfully');

console.log('Initializing motion detection...');
        (global as any).motionDetector = setupOptimizedMotionDetection((global as any).streamManager, io, (global as any).detectionService);
    console.log('Motion detection initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    // Continue without services - API routes will still work
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // Handle stream requests
  socket.on('requestStream', (data: { cameraId: string; role?: 'detect' | 'record' | 'live' }) => {
    const { cameraId, role = 'live' } = data;
    console.log(`Stream requested for camera: ${cameraId} role: ${role} by client: ${socket.id}`);
    const streamManager = (global as any).streamManager;
    if (streamManager) {
      const success = streamManager.startStream(cameraId, role);
      if (success) {
        // Join the camera role-specific room to receive frames
        socket.join(`camera-${cameraId}-${role}`);
        socket.emit('streamRequested', { cameraId, role, success: true });
        console.log(`Stream started successfully for camera: ${cameraId} ${role}, client ${socket.id} joined room camera-${cameraId}-${role}`);
      } else {
        socket.emit('streamError', { cameraId, role, error: 'Failed to start stream' });
        console.error(`Failed to start stream for camera: ${cameraId} ${role}`);
      }
    } else {
      socket.emit('streamError', { cameraId, role, error: 'Stream manager not available' });
      console.error('Stream manager not available');
    }
  });
  
  // Handle stop stream requests
  socket.on('stopStream', (data: { cameraId: string; role?: 'detect' | 'record' | 'live' }) => {
    const { cameraId, role = 'live' } = data;
    console.log(`Stop stream requested for camera: ${cameraId} role: ${role} by client: ${socket.id}`);
    const streamManager = (global as any).streamManager;
    if (streamManager) {
      // Leave the camera role-specific room
      socket.leave(`camera-${cameraId}-${role}`);
      const success = streamManager.stopStream(cameraId, role);
      if (success) {
        console.log(`Stream stopped successfully for camera: ${cameraId} ${role}, client ${socket.id} left room camera-${cameraId}-${role}`);
      } else {
        console.error(`Failed to stop stream for camera: ${cameraId} ${role}`);
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 8082;

server.listen(PORT, async () => {
  console.log(`SentryVision Server started on port ${PORT}`);

  // Initialize services after server starts
  await initializeServices(); // Now enabled with cameras.json mounted
});