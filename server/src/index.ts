// Server startup log disabled - console.log('*** SERVER STARTING - LOADING MODULES ***');

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import debug from 'debug';

// Socket.IO debugging disabled
// debug('socket.io:*').enabled = true;
import cors from 'cors';
import dotenv from 'dotenv';
import fileUpload from 'express-fileupload';

// Modules loaded log disabled - console.log('*** MODULES LOADED SUCCESSFULLY ***');

// Import logger early to capture all logs

import { setupRTSPStreams } from './streams/rtspManager.js';
import { configureRoutes } from './routes/index.js';
import { startCronJobs } from './utils/cronJobs.js';
import { setupSimpleMotionDetection } from './detection/simpleMotionDetection.js';
import { setupPersonDetection } from './detection/personDetection.js';
import { FaceRecognition, loadModules as loadFaceRecognitionModules } from './detection/faceRecognition.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AddressInfo } from 'net';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure necessary directories exist
const publicDir = path.join(__dirname, '../public');
const snapshotsDir = path.join(publicDir, 'snapshots');
const eventsDir = path.join(publicDir, 'events');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (!fs.existsSync(snapshotsDir)) {
  fs.mkdirSync(snapshotsDir, { recursive: true });
}
if (!fs.existsSync(eventsDir)) {
  fs.mkdirSync(eventsDir, { recursive: true });
}

// Load environment variables
dotenv.config();

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:8082',
  'http://localhost:5173',
  'http://127.0.0.1:8082',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // Add common IP ranges for Docker and local network
  'http://192.168.31.99:3020',
  'http://192.168.31.99:3000',
  'http://192.168.31.99:80'
];

// If FRONTEND_URL is set and not already in the list, add it
if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

// CORS origins log disabled - console.log('*** CORS ALLOWED ORIGINS:', allowedOrigins);

// Initialize express app
const app = express();
const server = http.createServer(app);

// Enable file uploads
app.use(fileUpload());

// Configure Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      // CORS check log disabled - console.log('*** SOCKET.IO CORS CHECK - Origin:', origin);
      
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        // No origin log disabled - console.log('*** SOCKET.IO CORS - No origin, allowing');
        callback(null, true);
        return;
      }
      
      // Check if the origin is allowed
      if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
        // Origin allowed log disabled - console.log('*** SOCKET.IO CORS - Origin allowed:', origin);
        callback(null, true);
      } else if (origin.includes(':8082') || origin.includes(':5173') || origin.includes(':3000') || origin.includes(':3020') || origin.includes(':80')) {
        // Allow any origin with development/production ports for easier development
        // Dev port log disabled - console.log('*** SOCKET.IO CORS - Development port detected, allowing:', origin);
        callback(null, true);
      } else if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)/)) {
        // Allow local network IPs
        // Local IP log disabled - console.log('*** SOCKET.IO CORS - Local network IP detected, allowing:', origin);
        callback(null, true);
      } else {
        // Origin blocked log disabled - console.log('*** SOCKET.IO CORS - Origin blocked:', origin);
        // Blocked request log disabled - console.warn(`Blocked socket request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  pingTimeout: 120000, // 2 minutes
  pingInterval: 45000, // 45 seconds
  upgradeTimeout: 30000,
  allowEIO3: true
});

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // Check if the origin is allowed
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else if (origin.includes(':8082') || origin.includes(':5173') || origin.includes(':3000') || origin.includes(':3020') || origin.includes(':80')) {
      // Allow any origin with development/production ports for easier development
      callback(null, true);
    } else if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)/)) {
      // Allow local network IPs
      callback(null, true);
    } else {
      // HTTP blocked log disabled - console.warn(`Blocked http request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'Content-Type']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Serve static files from public directory
app.use('/events', express.static(path.join(__dirname, '../public/events')));
app.use('/snapshots', express.static(path.join(__dirname, '../public/snapshots')));

// Socket.io connection handler
io.on('connection', (socket) => {
  // Socket connection log disabled - console.log('*** NEW SOCKET CONNECTION ***');
  // Client connected log disabled - console.log(`New client connected: ${socket.id} from: ${socket.handshake.address} Total connected clients: ${io.engine.clientsCount}`);
  
  // Send a welcome message to confirm connection
  socket.emit('connected', { 
    message: 'Successfully connected to server',
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });
  
  socket.on('disconnect', (reason) => {
    // Socket disconnect log disabled - console.log('*** SOCKET DISCONNECTED ***', socket.id, reason);
    // Client disconnect log disabled - console.log(`Client disconnected: ${socket.id} Reason: ${reason} Total connected clients: ${io.engine.clientsCount}`);
    // Clean up any camera rooms this client was in
    socket.rooms.forEach(room => {
      if (room.startsWith('camera-')) {
        socket.leave(room);
      }
    });
  });

  socket.on('error', (error) => {
    // Socket error log disabled - console.log('*** SOCKET ERROR ***', socket.id, error);
    // Socket error details disabled - console.error(`Socket error for client ${socket.id}`, error);
    // Don't disconnect on error, let the client handle reconnection
  });

  socket.on('connect_error', (error) => {
    // Socket connect error log disabled - console.log('*** SOCKET CONNECT ERROR ***', socket.id, error);
    // Socket connect error details disabled - console.error(`Socket error for client ${socket.id}`, error);
  });

  // Handle stream request from client
  socket.on('requestStream', (cameraId) => {
    try {
      // Stream request log disabled - console.log('*** STREAM REQUEST RECEIVED ***', cameraId, 'from', socket.id);
      // Stream request details disabled - console.log(`Stream requested for camera ${cameraId} from client ${socket.id}`);
      socket.join(`camera-${cameraId}`);
      
      // Emit a confirmation back to the client
      socket.emit('streamRequested', { cameraId, status: 'joined' });
      // Stream confirmed log disabled - console.log('*** STREAM REQUEST CONFIRMED ***', cameraId);
    } catch (error) {
      // Stream error log disabled - console.log('*** STREAM REQUEST ERROR ***', cameraId, error);
      // Stream error details disabled - console.error('Error handling stream request', 'STREAM', error);
      socket.emit('streamError', { cameraId, error: 'Failed to join stream' });
    }
  });

  // Handle stop stream request
  socket.on('stopStream', (cameraId) => {
    try {
      // Stop stream log disabled - console.log('*** STOP STREAM REQUEST ***', cameraId, 'from', socket.id);
      // Stop stream details disabled - console.log(`Stream stopped for camera ${cameraId} from client ${socket.id}`);
      socket.leave(`camera-${cameraId}`);
    } catch (error) {
      // Stop stream error log disabled - console.log('*** STOP STREAM ERROR ***', cameraId, error);
      // Stop stream error details disabled - console.error('Error handling stop stream', 'STREAM', error);
    }
  });
});

// Helper function to find an available port starting from the provided port
const findAvailablePort = (startPort: number): Promise<number> => {
  return new Promise((resolve) => {
    const testServer = http.createServer();
    testServer.once('error', () => {
      // Port is in use, try the next one
      testServer.close(() => {
        resolve(findAvailablePort(startPort + 1));
      });
    });
    
    testServer.once('listening', () => {
      // Found an available port
      const port = (testServer.address() as AddressInfo).port;
      testServer.close(() => {
        resolve(port);
      });
    });
    
    testServer.listen(startPort);
  });
};

// Set up server with dynamic port binding
const DEFAULT_PORT = parseInt(process.env.PORT || '9753', 10);
// Server start attempt log disabled - console.log(`Attempting to start server on port ${DEFAULT_PORT}`);

// Find an available port and start the server
(async () => {
  try {
    const PORT = await findAvailablePort(DEFAULT_PORT);
    
    if (PORT !== DEFAULT_PORT) {
      // Port change log disabled - console.log(`Port ${DEFAULT_PORT} was in use, using port ${PORT} instead`);
    }
    
    server.listen(PORT, async () => {
      console.log(`*** SERVER STARTED ON PORT ${PORT} ***`);
      // RTSP info log disabled - console.info(`*** RTSP STREAMING ENABLED ***`);
      // Socket.io info log disabled - console.info(`Socket.io running on port ${PORT}`);
      // Origins info log disabled - console.info(`Allowed origins: ${allowedOrigins.join(', ')}`);
      
      // Update the PORT in the process environment so other components can use it
      process.env.PORT = PORT.toString();
      
      try {
        // Setup RTSP streams with socket.io for sending frames
        const streamManager = await setupRTSPStreams(io);
        
        // Make streamManager available globally for routes
        global.streamManager = streamManager;
        
        // Configure routes
        configureRoutes(app, io);
        
        // Setup person detection
        const personDetector = await setupPersonDetection(streamManager, io);
        
        // Setup simple motion detection
        const motionDetector = await setupSimpleMotionDetection(streamManager, io, personDetector);
        
        // Load face recognition modules
        await loadFaceRecognitionModules();

        // Setup face recognition
        const faceRecognition = new FaceRecognition();

        // Start cron jobs
        startCronJobs(io);
      } catch (err) {
        // Setup error log disabled - console.error('Failed to setup application', 'SERVER', err);
      }
    });
  } catch (err) {
    // Server start error log disabled - console.error('Failed to start server', 'SERVER', err);
  }
})();
