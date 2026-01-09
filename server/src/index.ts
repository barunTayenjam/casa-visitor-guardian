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
import { objectDetectionService } from './detection/objectDetectionOpenCV.js';
import { facialRecognitionService } from './detection/facialRecognitionOpenCV.js';

dotenv.config({ path: './.env' });

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:5173', 'http://192.168.31.99:5173', 'http://192.168.31.99:8082'],
  credentials: true
}));
app.use(express.json());

// Serve static files from public directory
app.use('/events', (req, res, next) => {
  const filename = path.basename(req.path);
  console.log(`Events middleware: Processing request for ${filename}`);

  // Try to extract Unix timestamp from filename (e.g., faces_cam1_1760618163997.jpg)
  // Unix timestamps are typically 13 digits for millisecond precision
  const timestampMatch = filename.match(/(\d{13})\.(jpg|png|gif|jpeg)$/i);

  if (timestampMatch) {
    const timestamp = parseInt(timestampMatch[1]);
    if (!isNaN(timestamp)) {
      // Convert timestamp to date to determine year-month directory
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
      const yearMonth = `${year}-${month}`;

      const subType = filename.startsWith('faces_') ? 'faces' : (filename.includes('cam') ? 'motion' : 'faces');
      const detectionsPath = process.env.DETECTIONS_DIR || path.join(__dirname, '../../data/detections');
      const filePath = path.join(detectionsPath, yearMonth, 'events', subType, filename);

      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      }
    }
  }

  // Fallback: try the original pattern matching
  const match = filename.match(/(\d{4}-\d{2})/);
  if (match) {
    const yearMonth = match[1];
    const subType = filename.startsWith('faces_') ? 'faces' : (filename.includes('cam') ? 'motion' : 'faces');
    const detectionsPath = process.env.DETECTIONS_DIR || path.join(__dirname, '../../data/detections');
    const filePath = path.join(detectionsPath, yearMonth, 'events', subType, filename);

    console.log(`Events middleware: Pattern match found. YearMonth: ${yearMonth}, SubType: ${subType}, FilePath: ${filePath}, File exists: ${fs.existsSync(filePath)}`);

    if (fs.existsSync(filePath)) {
      console.log(`Events middleware: Sending file ${filePath}`);
      return res.sendFile(filePath);
    }
  }

  // Ultimate fallback: scan all year-month directories for the file
  const detectionsPath = process.env.DETECTIONS_DIR || path.join(__dirname, '../../data/detections');
  if (fs.existsSync(detectionsPath)) {
    try {
      const yearMonthDirs = fs.readdirSync(detectionsPath).filter(item =>
        fs.statSync(path.join(detectionsPath, item)).isDirectory() && /^\d{4}-\d{2}$/.test(item)
      );

      for (const yearMonth of yearMonthDirs) {
        const subTypes = ['faces', 'motion']; // Common subtypes
        for (const subType of subTypes) {
          const filePath = path.join(detectionsPath, yearMonth, 'events', subType, filename);
          if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
          }
        }
      }
    } catch (err) {
      console.error('Error scanning for event files:', err);
    }
  }

  const fallbackPath = path.join(process.cwd(), 'public/events', req.path);
  if (fs.existsSync(fallbackPath)) {
    return res.sendFile(fallbackPath);
  }

  next();
});
// Serve snapshots - both from public directory and from detections organized by date
app.use('/snapshots', (req, res, next) => {
  const parsedPath = path.parse(req.path);
  const filename = path.basename(req.path);
  const dirName = parsedPath.dir.split('/').pop(); // Get the directory name from the path

  // If the directory name looks like a year-month (e.g., 2026-01), use it directly
  if (dirName && /^\d{4}-\d{2}$/.test(dirName)) {
    const snapshotsPath = process.env.SNAPSHOTS_DIR || path.join(__dirname, '../../data/detections');
    const filePath = path.join(snapshotsPath, dirName, 'snapshots', filename);

    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  } else {
    // If no yearMonth in URL path, scan all year-month directories
    const snapshotsPath = process.env.SNAPSHOTS_DIR || path.join(__dirname, '../../data/detections');

    if (fs.existsSync(snapshotsPath)) {
      try {
        const yearMonthDirs = fs.readdirSync(snapshotsPath).filter(item =>
          fs.statSync(path.join(snapshotsPath, item)).isDirectory() && /^\d{4}-\d{2}$/.test(item)
        );

        for (const yearMonth of yearMonthDirs) {
          const filePath = path.join(snapshotsPath, yearMonth, 'snapshots', filename);
          if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
          }
        }
      } catch (err) {
        console.error('Error scanning for snapshot files:', err);
      }
    }
  }

  // Fallback to public snapshots directory
  const fallbackPath = path.join(process.cwd(), 'public/snapshots', req.path);
  if (fs.existsSync(fallbackPath)) {
    return res.sendFile(fallbackPath);
  }

  next();
});
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
    
    // Initialize OpenCV object detection service
    console.log('Initializing OpenCV object detection service...');
    const opencvStatus = await objectDetectionService.getServiceStatus();
    if (opencvStatus.available) {
      console.log(`OpenCV service available at ${opencvStatus.url} (${opencvStatus.responseTime}ms)`);
      (global as any).objectDetectionService = objectDetectionService;
    } else {
      console.warn('OpenCV service not available, using stub detection');
    }

    // Initialize OpenCV facial recognition service
    console.log('Initializing OpenCV facial recognition service...');
    try {
      // Test the facial recognition service
      const faceRecognitionStatus = facialRecognitionService.isReady();
      if (faceRecognitionStatus) {
        console.log('Facial recognition service initialized successfully');
        (global as any).facialRecognitionService = facialRecognitionService;
      } else {
        console.warn('Facial recognition service not ready, using stub detection');
      }
    } catch (error) {
      console.warn('Facial recognition service initialization failed:', error);
    }
    
    console.log('Initializing stream manager...');
    (global as any).streamManager = await setupRTSPStreams(io);
    console.log('Stream manager initialized successfully');

    console.log('Initializing motion detection...');
    (global as any).motionDetector = setupOptimizedMotionDetection((global as any).streamManager, io);
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
  socket.on('requestStream', (cameraId: string) => {
    console.log(`Stream requested for camera: ${cameraId} by client: ${socket.id}`);
    const streamManager = (global as any).streamManager;
    if (streamManager) {
      const success = streamManager.startStream(cameraId);
      if (success) {
        // Join the camera room to receive frames
        socket.join(`camera-${cameraId}`);
        socket.emit('streamRequested', { cameraId, success: true });
        console.log(`Stream started successfully for camera: ${cameraId}, client ${socket.id} joined room camera-${cameraId}`);
      } else {
        socket.emit('streamError', { cameraId, error: 'Failed to start stream' });
        console.error(`Failed to start stream for camera: ${cameraId}`);
      }
    } else {
      socket.emit('streamError', { cameraId, error: 'Stream manager not available' });
      console.error('Stream manager not available');
    }
  });
  
  // Handle stop stream requests
  socket.on('stopStream', (cameraId: string) => {
    console.log(`Stop stream requested for camera: ${cameraId} by client: ${socket.id}`);
    const streamManager = (global as any).streamManager;
    if (streamManager) {
      // Leave the camera room
      socket.leave(`camera-${cameraId}`);
      const success = streamManager.stopStream(cameraId);
      if (success) {
        console.log(`Stream stopped successfully for camera: ${cameraId}, client ${socket.id} left room camera-${cameraId}`);
      } else {
        console.error(`Failed to stop stream for camera: ${cameraId}`);
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
