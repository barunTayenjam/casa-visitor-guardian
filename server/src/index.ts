import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupRTSPStreams } from './streams/rtspManager.js';
import { configureRoutes } from './routes/index.js';
import { startCronJobs } from './utils/cronJobs.js';
import { setupMotionDetection } from './detection/motionDetection.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Handle stream request from client
  socket.on('requestStream', (cameraId) => {
    console.log(`Stream requested for camera ${cameraId}`);
    socket.join(`camera-${cameraId}`);
  });

  // Handle stop stream request
  socket.on('stopStream', (cameraId) => {
    console.log(`Stream stopped for camera ${cameraId}`);
    socket.leave(`camera-${cameraId}`);
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
      const port = (testServer.address() as any).port;
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
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.io running on port ${PORT}`);
      console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:8080'}`);
      
      // Update the PORT in the process environment so other components can use it
      process.env.PORT = PORT.toString();
      
      try {
        // Setup RTSP streams with socket.io for sending frames
        const streamManager = await setupRTSPStreams(io);
        
        // Make streamManager available globally for routes
        (global as any).streamManager = streamManager;
        
        // Setup motion and person detection
        const motionDetector = setupMotionDetection(streamManager, io);
        (global as any).motionDetector = motionDetector;
        
        // Configure API routes after streamManager is set up
        configureRoutes(app, io);
        
        // Start scheduled tasks (daily reports, etc.)
        startCronJobs(io);
      } catch (err: any) {
        console.error('Error during server initialization:', err);
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();

export { io };

