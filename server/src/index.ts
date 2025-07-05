console.log('*** SERVER STARTING - LOADING MODULES ***');

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import debug from 'debug';

// Enable Socket.IO debugging
debug('socket.io:*').enabled = true;
import cors from 'cors';
import dotenv from 'dotenv';

console.log('*** MODULES LOADED SUCCESSFULLY ***');

// Import logger early to capture all logs

import { setupRTSPStreams } from './streams/rtspManager.js';
import { configureRoutes } from './routes/index.js';
import { startCronJobs } from './utils/cronJobs.js';
import { setupSimpleMotionDetection } from './detection/simpleMotionDetection.js';

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
  'http://127.0.0.1:3000'
];

// If FRONTEND_URL is set and not already in the list, add it
if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

console.log('*** CORS ALLOWED ORIGINS:', allowedOrigins);

// Initialize express app
const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      console.log('*** SOCKET.IO CORS CHECK - Origin:', origin);
      
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        console.log('*** SOCKET.IO CORS - No origin, allowing');
        callback(null, true);
        return;
      }
      
      // Check if the origin is allowed
      if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
        console.log('*** SOCKET.IO CORS - Origin allowed:', origin);
        callback(null, true);
      } else if (origin.includes(':8082') || origin.includes(':5173') || origin.includes(':3000')) {
        // Allow any origin with development ports for easier development
        console.log('*** SOCKET.IO CORS - Development port detected, allowing:', origin);
        callback(null, true);
      } else {
        console.log('*** SOCKET.IO CORS - Origin blocked:', origin);
        console.warn(`Blocked socket request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
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
    } else if (origin.includes(':8082') || origin.includes(':5173') || origin.includes(':3000')) {
      // Allow any origin with development ports for easier development
      callback(null, true);
    } else {
      console.warn(`Blocked http request from origin: ${origin}`);
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
  console.log('*** NEW SOCKET CONNECTION ***');
  console.log(`New client connected: ${socket.id} from: ${socket.handshake.address} Total connected clients: ${io.engine.clientsCount}`);
  
  // Send a welcome message to confirm connection
  socket.emit('connected', { 
    message: 'Successfully connected to server',
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });
  
  socket.on('disconnect', (reason) => {
    console.log('*** SOCKET DISCONNECTED ***', socket.id, reason);
    console.log(`Client disconnected: ${socket.id} Reason: ${reason} Total connected clients: ${io.engine.clientsCount}`);
    // Clean up any camera rooms this client was in
    socket.rooms.forEach(room => {
      if (room.startsWith('camera-')) {
        socket.leave(room);
      }
    });
  });

  socket.on('error', (error) => {
    console.log('*** SOCKET ERROR ***', socket.id, error);
    console.error(`Socket error for client ${socket.id}`, error);
    // Don't disconnect on error, let the client handle reconnection
  });

  socket.on('connect_error', (error) => {
    console.log('*** SOCKET CONNECT ERROR ***', socket.id, error);
    console.error(`Socket error for client ${socket.id}`, error);
  });

  // Handle stream request from client
  socket.on('requestStream', (cameraId) => {
    try {
      console.log('*** STREAM REQUEST RECEIVED ***', cameraId, 'from', socket.id);
      console.log(`Stream requested for camera ${cameraId} from client ${socket.id}`);
      socket.join(`camera-${cameraId}`);
      
      // Emit a confirmation back to the client
      socket.emit('streamRequested', { cameraId, status: 'joined' });
      console.log('*** STREAM REQUEST CONFIRMED ***', cameraId);
    } catch (error) {
      console.log('*** STREAM REQUEST ERROR ***', cameraId, error);
      console.error('Error handling stream request', 'STREAM', error);
      socket.emit('streamError', { cameraId, error: 'Failed to join stream' });
    }
  });

  // Handle stop stream request
  socket.on('stopStream', (cameraId) => {
    try {
      console.log('*** STOP STREAM REQUEST ***', cameraId, 'from', socket.id);
      console.log(`Stream stopped for camera ${cameraId} from client ${socket.id}`);
      socket.leave(`camera-${cameraId}`);
    } catch (error) {
      console.log('*** STOP STREAM ERROR ***', cameraId, error);
      console.error('Error handling stop stream', 'STREAM', error);
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
console.log(`Attempting to start server on port ${DEFAULT_PORT}`);

// Find an available port and start the server
(async () => {
  try {
    const PORT = await findAvailablePort(DEFAULT_PORT);
    
    if (PORT !== DEFAULT_PORT) {
      console.log(`Port ${DEFAULT_PORT} was in use, using port ${PORT} instead`);
    }
    
    server.listen(PORT, async () => {
      console.log(`*** SERVER STARTED ON PORT ${PORT} ***`);
      console.info(`*** RTSP STREAMING ENABLED ***`);
      console.info(`Socket.io running on port ${PORT}`);
      console.info(`Allowed origins: ${allowedOrigins.join(', ')}`);
      
      // Update the PORT in the process environment so other components can use it
      process.env.PORT = PORT.toString();
      
      try {
        // Setup RTSP streams with socket.io for sending frames
        const streamManager = await setupRTSPStreams(io);
        
        // Make streamManager available globally for routes
        global.streamManager = streamManager;
        
        // Configure routes
        configureRoutes(app, io);
        
        // Setup simple motion detection
        await setupSimpleMotionDetection(streamManager, io);
        
        // Start cron jobs
        startCronJobs(io);
      } catch (err) {
        console.error('Failed to setup application', 'SERVER', err);
      }
    });
  } catch (err) {
    console.error('Failed to start server', 'SERVER', err);
  }
})();
