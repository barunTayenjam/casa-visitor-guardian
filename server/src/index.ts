// Server startup log disabled - console.log('*** SERVER STARTING - LOADING MODULES ***');

import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import debug from 'debug';
import cors from 'cors';
import dotenv from 'dotenv';

// Import configuration and logger
import { config, validateConfig } from './config/index.js';
import { logger } from './utils/logger.js';

// Import security middleware
import { createApiRateLimit, ipBlocker, violationTracker, resetIPLimit, clearRateLimits } from './middleware/rateLimit.js';
import { createDetectionRateLimit } from './middleware/enhancedRateLimit.js';
import { commonSchemas } from './middleware/validation.js';
import cacheService from './services/cacheService.js';
import { 
  enforceHTTPS, 
  customSecurityHeaders, 
  validateRequest, 
  validateApiKey, 
  configureHelmet 
} from './middleware/security.js';
import { auditMiddleware } from './utils/auditLogger.js';

// Import modules
import { setupRTSPStreams, StreamManager } from './streams/rtspManager.js';
import { configureRoutes } from './routes/index.js';
import { configureAuthRoutes } from './routes/auth.js';
import { configureBatchProcessingRoutes } from './routes/batchProcessing.js';
import { startCronJobs } from './utils/cronJobs.js';
import { setupOptimizedMotionDetection, OptimizedMotionDetector } from './detection/optimizedMotionDetection.js';
import { objectDetectionService, ObjectDetectionService } from './detection/objectDetection.js';
import { facialRecognitionService, FacialRecognitionService } from './detection/facialRecognition.js';
import { motionBatchIntegration } from './integrations/motionBatchIntegration.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AddressInfo } from 'net';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Validate configuration
try {
  validateConfig();
  logger.info('Configuration validated successfully', 'Server');
} catch (error) {
  logger.error(`Configuration validation failed: ${error}`, 'Server');
  process.exit(1);
}

// Ensure necessary directories exist
const publicDir = path.join(__dirname, '../public');
const snapshotsDir = config.storage.snapshotsDir;
const eventsDir = config.storage.eventsDir;

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (!fs.existsSync(snapshotsDir)) {
  fs.mkdirSync(snapshotsDir, { recursive: true });
}
if (!fs.existsSync(eventsDir)) {
  fs.mkdirSync(eventsDir, { recursive: true });
}

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:8082',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:8082',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // Add common IP ranges for Docker and local network
  'http://192.168.31.99:3020',
  'http://192.168.31.99:3000',
  'http://192.168.31.99:80'
];

// Performance optimization settings
const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS || '100');
const MAX_CONCURRENT_STREAMS = parseInt(process.env.MAX_CONCURRENT_STREAMS || '50');
const CLEANUP_INTERVAL = parseInt(process.env.CLEANUP_INTERVAL || '300000'); // 5 minutes
const MEMORY_THRESHOLD_MB = parseInt(process.env.MEMORY_THRESHOLD_MB || '500');
const ENABLE_CACHE = process.env.ENABLE_CACHE !== 'false';

// Track active connections and streams
const activeConnections = new Set<Socket>();
const activeStreams = new Set<string>();
let totalConnections = 0;

// If FRONTEND_URL is set and not already in the list, add it
if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

// Initialize express app
const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
        callback(null, true);
      } else if (origin.includes(':8082') || origin.includes(':5173') || origin.includes(':5174') || origin.includes(':3000') || origin.includes(':3020') || origin.includes(':80')) {
        callback(null, true);
      } else if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)/)) {
        callback(null, true);
      } else {
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

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else if (origin.includes(':8082') || origin.includes(':5173') || origin.includes(':5174') || origin.includes(':3000') || origin.includes(':3020') || origin.includes(':80')) {
      callback(null, true);
    } else if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)/)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Security middleware
app.use(configureHelmet());
app.use(customSecurityHeaders);
app.use(validateRequest);
app.use(ipBlocker());
app.use(violationTracker());

// Create rate limit instance once
const apiRateLimit = createApiRateLimit();

// Bypass rate limiting for batch processing in development
const shouldApplyRateLimit = (req: any, res: any, next: any) => {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') {
    // Skip rate limiting for batch processing in development
    if (req.path.startsWith('/api/batch') || req.path.startsWith('/api/admin')) {
      return next();
    }
  }
  return apiRateLimit(req, res, next);
};

app.use(shouldApplyRateLimit);

// Development rate limit reset endpoints
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') {
  app.get('/api/admin/reset-rate-limits', (req, res) => {
    clearRateLimits();
    res.json({
      success: true,
      message: 'Rate limits cleared for development'
    });
  });
  
  app.get('/api/admin/reset-ip/:ip', (req, res) => {
    const { ip } = req.params;
    resetIPLimit(ip);
    res.json({
      success: true,
      message: `Rate limits cleared for IP: ${ip}`
    });
  });
}

// Enhanced rate limiting for detection endpoints
app.use('/api/detection', createDetectionRateLimit());

// HTTPS enforcement (only in production)
if (process.env.NODE_ENV === 'production') {
  app.use(enforceHTTPS);
}

// API key validation for external integrations
app.use('/api', validateApiKey);

// Audit logging middleware
app.use('/api', auditMiddleware('API_REQUEST', 'API'));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Serve static files from public directory
app.use('/events', express.static(path.join(__dirname, '../public/events')));
app.use('/snapshots', express.static(path.join(__dirname, '../public/snapshots')));
app.use('/batch-results', express.static(path.join(__dirname, '../public/batch-results')));

// Socket.io connection handler
io.on('connection', (socket: Socket) => {
  // Connection limits and monitoring
  totalConnections++;
  activeConnections.add(socket);
  
  // Enforce connection limits
  if (activeConnections.size > MAX_CONNECTIONS) {
    console.warn(`Connection limit reached (${MAX_CONNECTIONS}). Rejecting new connection from ${socket.id}`);
    socket.emit('error', { message: 'Server at capacity' });
    socket.disconnect(true);
    return;
  }
  
  // Log connection details (optimized)
  if (process.env.NODE_ENV !== 'production' || totalConnections % 10 === 0) {
    logger.socketConnect(socket.id, socket.handshake.address, activeConnections.size);
  }
  
  // Send a welcome message to confirm connection
  socket.emit('connected', { 
    message: 'Successfully connected to server',
    socketId: socket.id,
    timestamp: new Date().toISOString(),
    serverLoad: {
      activeConnections: activeConnections.size,
      maxConnections: MAX_CONNECTIONS,
      activeStreams: activeStreams.size
    }
  });
  
  socket.on('disconnect', (reason) => {
    // Clean up connection tracking
    activeConnections.delete(socket);
    
    // Log disconnection (optimized)
    if (process.env.NODE_ENV !== 'production') {
      logger.socketDisconnect(socket.id, reason, activeConnections.size);
    }
    
    // Clean up any camera rooms this client was in
    socket.rooms.forEach(room => {
      if (room.startsWith('camera-')) {
        socket.leave(room);
        // Check if this was the last client in the room
        const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
        if (roomSize === 0) {
          activeStreams.delete(room);
        }
      }
    });
  });

  socket.on('error', (error) => {
    // Socket error log disabled - console.log('*** SOCKET ERROR ***', socket.id, error);
  });

  socket.on('connect_error', (error) => {
    // Socket connect error log disabled - console.log('*** SOCKET CONNECT ERROR ***', socket.id, error);
  });

  // Handle stream request from client
  socket.on('requestStream', (cameraId: string) => {
    try {
      // Enforce stream limits
      if (activeStreams.size >= MAX_CONCURRENT_STREAMS) {
        socket.emit('streamError', { 
          cameraId, 
          error: 'Maximum concurrent streams reached' 
        });
        return;
      }
      
      const streamRoom = `camera-${cameraId}`;
      socket.join(streamRoom);
      activeStreams.add(streamRoom);
      
      // Log stream request (optimized)
      if (process.env.NODE_ENV !== 'production') {
        logger.streamRequest(cameraId, socket.id);
      }
      
      // Emit a confirmation back to the client
      socket.emit('streamRequested', { cameraId, status: 'joined' });
    } catch (error) {
      console.error('Stream request error:', error);
      socket.emit('streamError', { cameraId, error: 'Failed to join stream' });
    }
  });

  // Handle stop stream request
  socket.on('stopStream', (cameraId: string) => {
    try {
      const streamRoom = `camera-${cameraId}`;
      socket.leave(streamRoom);
      
      // Check if this was the last client in the room
      const roomSize = io.sockets.adapter.rooms.get(streamRoom)?.size || 0;
      if (roomSize === 0) {
        activeStreams.delete(streamRoom);
      }
      
      // Log stream stop (optimized)
      if (process.env.NODE_ENV !== 'production') {
        logger.streamStop(cameraId, socket.id);
      }
    } catch (error) {
      console.error('Stop stream error:', error);
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
const DEFAULT_PORT = config.port;
logger.info(`Attempting to start server on port ${DEFAULT_PORT}`, 'Server');

// Find an available port and start the server
(async () => {
  try {
    const PORT = await findAvailablePort(DEFAULT_PORT);
    
    if (PORT !== DEFAULT_PORT) {
      // Port change log disabled - console.log(`Port ${DEFAULT_PORT} was in use, using port ${PORT} instead`);
    }
    
    server.listen(PORT, async () => {
      console.log(`*** SERVER STARTED ON PORT ${PORT} ***`);
      
      // Update the PORT in the process environment so other components can use it
      process.env.PORT = PORT.toString();
      
      try {
        // Setup RTSP streams with socket.io for sending frames
        const streamManager: StreamManager = await setupRTSPStreams(io);
        
        // Make streamManager available globally for routes. This is not ideal, but it is a simple way to share the instance.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global as any).streamManager = streamManager;
        
        // Configure routes
        configureRoutes(app, io);
        
        // Configure auth routes
        configureAuthRoutes(app);
        
        // Configure batch processing routes
        configureBatchProcessingRoutes(app);
        
        // Initialize motion-triggered detection and batch integration
        setupMotionBatchIntegration(io);
        
        // Setup optimized motion detection
        const motionDetector: OptimizedMotionDetector = await setupOptimizedMotionDetection(streamManager, io);
        
        // Initialize detection services globally. This is not ideal, but it is a simple way to share the instances.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global as any).objectDetectionService = objectDetectionService;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global as any).facialRecognitionService = facialRecognitionService;
        
        // Make detection services available to routes
        console.log('Detection services initialized:');
        console.log('- Object Detection:', !!objectDetectionService);
        console.log('- Facial Recognition:', !!facialRecognitionService);
        console.log('- Motion-Triggered Detection:', !!motionBatchIntegration);
        
        // Suppress duplicate library warnings (just skip - they're harmless)
        console.log('Note: Library duplicate warnings may appear - these are harmless');
        
        // Initialize cache service
        if (ENABLE_CACHE) {
          try {
            await cacheService.connect();
            console.log('Cache service initialized successfully');
          } catch (error) {
            console.warn('Cache service failed to initialize, using memory fallback:', error);
          }
        }
        
        // Start cron jobs
        startCronJobs(io);
        
        // Setup performance monitoring and cleanup
        setupPerformanceMonitoring(io);
        
      } catch (err) {
        console.error('Failed to setup application', err);
      }
    });
  } catch (err) {
    console.error('Failed to start server', err);
  }
})();

// Performance monitoring and cleanup
function setupPerformanceMonitoring(io: SocketIOServer) {
  // Periodic cleanup and monitoring
  setInterval(() => {
    try {
      const memUsage = process.memoryUsage();
      const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      // Memory threshold monitoring
      if (memUsageMB > MEMORY_THRESHOLD_MB) {
        logger.performance('Memory Usage Warning', memUsageMB, 'MB');
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Emit memory warning to admin clients
        io.emit('systemWarning', {
          type: 'memory',
          usage: memUsageMB,
          threshold: MEMORY_THRESHOLD_MB,
          timestamp: new Date().toISOString()
        });
      }
      
      // Log system stats (in production only periodically)
      if (process.env.NODE_ENV !== 'production' || memUsageMB > MEMORY_THRESHOLD_MB * 0.8) {
        logger.performance('System Status', activeConnections.size, 'connections');
      }
      
      // Cleanup disconnected sockets
      const sockets = io.sockets.sockets;
      let cleanedUp = 0;
      sockets.forEach((socket: Socket) => {
        if (!socket.connected) {
          activeConnections.delete(socket);
          cleanedUp++;
        }
      });
      
      if (cleanedUp > 0) {
        logger.performance('Socket Cleanup', cleanedUp, 'sockets');
      }
      
    } catch (error) {
      logger.error('Performance monitoring error', 'PERFORMANCE', error);
    }
  }, CLEANUP_INTERVAL);
  
  logger.performance('Performance monitoring enabled', CLEANUP_INTERVAL, 'ms');
}

function setupMotionBatchIntegration(io: SocketIOServer): void {
  // Setup motion batch integration
  motionBatchIntegration.on('motionEvent', (event) => {
    // Forward motion events to connected clients
    io.emit('motionDetected', event);
  });

  motionBatchIntegration.on('batchCompleted', (data) => {
    // Notify clients of batch completion
    io.emit('batchCompleted', data);
  });

  motionBatchIntegration.on('batchFailed', (data) => {
    // Notify clients of batch failures
    io.emit('batchFailed', data);
  });

  logger.info('Motion-triggered detection and batch integration enabled', 'SYSTEM');
}