// Server startup
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

// Import configuration
import { config } from './config/index.js';

import { configureRoutes } from './routes/index.js';
import { configureAuthRoutes } from './routes/auth.js';
import { setupRTSPStreams } from './streams/rtspManager.js';

dotenv.config({ path: './.env' });

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Configure Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
  }
});

// Basic routes
app.get('/health', (req, res) => {
  console.log('Health endpoint called');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ message: 'Test successful' });
});

// Configure routes first
configureAuthRoutes(app);
configureRoutes(app, io);
console.log('Routes configured successfully');

// Initialize stream manager
async function initializeServices() {
  try {
    console.log('Initializing stream manager...');
    (global as any).streamManager = await setupRTSPStreams(io);
    console.log('Stream manager initialized successfully');
  } catch (error) {
    console.error('Failed to initialize stream manager:', error);
    // Continue without stream manager - API routes will still work
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
const PORT = process.env.PORT || 9753;

server.listen(PORT, async () => {
  console.log(`SentryVision Server started on port ${PORT}`);
  
  // Configure routes first
  configureAuthRoutes(app);
  configureRoutes(app, io);
  console.log('Routes configured successfully');
  
  // Initialize services after server starts
  //   //   // await initializeServices(); // Disabled for testing // Disabled for testing // Disabled for testing - stream manager hanging
});// Test endpoint
app.get('/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ message: 'Test successful' });
});
