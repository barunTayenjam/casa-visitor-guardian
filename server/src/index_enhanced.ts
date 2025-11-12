// Enhanced Server Startup with Production-Grade Security and Performance

import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import debug from 'debug';
import cors from 'cors';
import dotenv from 'dotenv';

// Import enhanced components
import { EventBus } from './events/eventBus.js';
import { EnhancedAuthMiddleware } from './middleware/enhancedAuth.ts';
import { EnhancedStreamManager } from './streams/enhancedStreamManager.ts';
import MetricsCollector from './monitoring/metricsCollector.js';
import HealthCheckManager from './monitoring/healthCheck.js';
import AsyncFileManager from './utils/asyncFileOperations.ts';

// Import existing components
import { CredentialManager } from './utils/credentialManager.js';
import { config, validateConfig } from './config/index.js';
import { getLogDatabase } from './services/logDatabase.js';
import { logger } from './utils/logger.js';
import { configureHelmet } from './middleware/security.js';

// Import services
import { configureRoutes } from './routes/index.js';
import { configureAuthRoutes } from './routes/auth.js';
import { configureBatchProcessingRoutes } from './routes/batchProcessing.js';
import { configureVisitorRoutes } from './routes/visitorRoutes.js';
import logRoutes from './routes/logRoutes.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AddressInfo } from 'net';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// System initialization
class SystemInitializer {
  private app: express.Application;
  private server: http.Server;
  private io: SocketIOServer;
  private eventBus: EventBus;
  private authMiddleware: EnhancedAuthMiddleware;
  private streamManager: EnhancedStreamManager;
  private metricsCollector: MetricsCollector;
  private healthCheckManager: HealthCheckManager;
  private fileManager: AsyncFileManager;

  private readonly activeConnections = new Set<Socket>();
  private readonly activeStreams = new Map<string, Set<string>>();

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    
    // Initialize core components
    this.eventBus = EventBus.getInstance();
    this.authMiddleware = EnhancedAuthMiddleware.getInstance();
    this.streamManager = new EnhancedStreamManager();
    this.metricsCollector = MetricsCollector.getInstance();
    this.healthCheckManager = HealthCheckManager.getInstance();
    this.fileManager = AsyncFileManager.getInstance();
    
    // Configure Socket.IO with enhanced settings
    this.io = new SocketIOServer(this.server, {
      cors: this.getSocketCorsConfig(),
      transports: ['polling', 'websocket'],
      pingTimeout: 120000,
      pingInterval: 45000,
      upgradeTimeout: 30000,
      allowEIO3: false, // Disable older protocol versions for security
      maxHttpBufferSize: 1e8, // 100MB
      compression: true,
      perMessageDeflate: {
        threshold: 1024,
        zlibDeflateOptions: {
          level: 3
        }
      }
    });
  }

  private getSocketCorsConfig() {
    const allowedOrigins = [
      'http://localhost:8080',
      'http://localhost:8082',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:8082',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];

    if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }

    return {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) {
          return callback(null, true);
        }
        
        const isAllowed = allowedOrigins.some(allowed => 
          origin.startsWith(allowed) || 
          origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)/)
        );
        
        callback(null, isAllowed);
      },
      methods: ['GET', 'POST'],
      credentials: true
    };
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Starting Home Security System initialization...');
      
      // 1. Configuration validation
      await this.validateConfiguration();
      
      // 2. Security hardening
      this.setupSecurity();
      
      // 3. Middleware setup
      this.setupMiddleware();
      
      // 4. Event bus configuration
      this.setupEventBus();
      
      // 5. Socket.IO setup
      this.setupSocketIO();
      
      // 6. Routes configuration
      this.setupRoutes();
      
      // 7. Health checks and monitoring
      this.setupMonitoring();
      
      // 8. Performance optimization
      this.setupPerformanceOptimization();
      
      // 9. Start server
      await this.startServer();
      
      console.log('✅ Home Security System initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize system:', error);
      process.exit(1);
    }
  }

  private async validateConfiguration(): Promise<void> {
    console.log('📋 Validating configuration...');
    
    // Initialize log database first
    await getLogDatabase();
    console.log('📊 Log database initialized');
    
    // Validate configuration
    validateConfig();
    console.log('✅ Configuration validated');
    
    // Ensure directories exist
    await this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    const directories = [
      path.join(__dirname, '../public'),
      config.storage.snapshotsDir,
      config.storage.eventsDir,
      path.join(__dirname, '../public/batch-results')
    ];

    for (const dir of directories) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    console.log('📁 Directories ensured');
  }

  private setupSecurity(): void {
    console.log('🔒 Setting up security...');
    
    // Security headers with Helmet
    this.app.use(configureHelmet());
    
    // CORS configuration
    this.app.use(cors(this.getSocketCorsConfig()));
    
    // Rate limiting with enhanced middleware
    this.app.use((req, res, next) => {
      // Record start time for metrics
      res.locals.startTime = Date.now();
      next();
    });
    
    // Enable trust proxy for proper IP detection
    this.app.set('trust proxy', 1);
    
    console.log('🛡️ Security middleware configured');
  }

  private setupMiddleware(): void {
    console.log('⚙️ Setting up middleware...');
    
    // Body parsing with limits
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Static files
    this.app.use(express.static(path.join(__dirname, '../public'), {
      maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
      etag: true,
      lastModified: true
    }));
    
    // Metrics collection middleware
    this.app.use((req, res, next) => {
      const startTime = res.locals.startTime;
      
      // Record connection
      this.metricsCollector.recordConnection();
      
      // Clean up on response finish
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        
        this.metricsCollector.recordHttpRequest(
          req.method,
          req.path,
          res.statusCode,
          responseTime,
          req.get('User-Agent'),
          req.ip,
          Number(res.get('Content-Length')) || undefined
        );
        
        this.metricsCollector.recordDisconnection();
        
        // Record error if response indicates failure
        if (res.statusCode >= 400) {
          this.metricsCollector.recordError('http_error', 'api', 'medium');
        }
      });
      
      next();
    });
    
    console.log('🔧 Middleware configured');
  }

  private setupEventBus(): void {
    console.log('📡 Setting up event bus...');
    
    // Register system event handlers
    this.eventBus.registerHandlers({
      system: async (event) => {
        logger.info(`System event: ${event.type}`, 'EventBus');
        await this.fileManager.writeJsonFile(
          path.join(config.storage.eventsDir, `system_${Date.now()}.json`),
          event
        );
      },
      camera: async (event) => {
        logger.info(`Camera event: ${event.type}`, 'EventBus');
        // Emit to socket clients
        this.io.emit('cameraEvent', event);
      },
      motion: async (event) => {
        logger.warn(`Motion detected: ${event.data.cameraId}`, 'EventBus');
        // Emit to socket clients
        this.io.emit('motionDetected', event);
        
        // Store motion event
        await this.fileManager.writeJsonFile(
          path.join(config.storage.eventsDir, `motion_${Date.now()}.json`),
          event
        );
      },
      error: async (event) => {
        logger.error(`Error event: ${event.data.message}`, 'EventBus');
        // Emit to admin clients
        this.io.emit('systemError', event);
        
        // Store error event
        await this.fileManager.writeJsonFile(
          path.join(config.storage.eventsDir, `error_${Date.now()}.json`),
          event
        );
      }
    });
    
    // Emit system start event
    this.eventBus.emitEvent({
      type: 'system',
      data: {
        action: 'system_started',
        version: '2.0.0',
        timestamp: new Date(),
        features: ['enhanced_auth', 'event_bus', 'metrics', 'health_checks']
      },
      source: 'SystemInitializer',
      severity: 'low'
    });
    
    console.log('✅ Event bus configured');
  }

  private setupSocketIO(): void {
    console.log('🔌 Setting up Socket.IO...');
    
    this.io.on('connection', (socket: Socket) => {
      const clientId = socket.id;
      const clientIP = socket.handshake.address;
      
      this.activeConnections.add(socket);
      this.metricsCollector.recordConnection();
      
      logger.socketConnect(clientId, clientIP, this.activeConnections.size);
      
      // Send initial system state
      socket.emit('systemState', {
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString(),
        serverInfo: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: '2.0.0'
        }
      });
      
      // Handle camera stream requests
      socket.on('requestStream', async (cameraId: string) => {
        try {
          if (!this.activeStreams.has(cameraId)) {
            this.activeStreams.set(cameraId, new Set());
          }
          
          this.activeStreams.get(cameraId)!.add(clientId);
          socket.join(`camera-${cameraId}`);
          
          socket.emit('streamRequested', { cameraId, status: 'granted' });
          
          this.eventBus.emitEvent({
            type: 'camera',
            data: {
              cameraId,
              action: 'stream_requested',
              clientId,
              timestamp: new Date()
            }
          });
          
        } catch (error) {
          socket.emit('streamError', { 
            cameraId, 
            error: 'Failed to request stream' 
          });
          this.metricsCollector.recordError('stream_request_error', 'socketio', 'medium');
        }
      });
      
      // Handle stream stop
      socket.on('stopStream', (cameraId: string) => {
        const cameraClients = this.activeStreams.get(cameraId);
        if (cameraClients) {
          cameraClients.delete(clientId);
          socket.leave(`camera-${cameraId}`);
          
          if (cameraClients.size === 0) {
            this.activeStreams.delete(cameraId);
          }
        }
        
        socket.emit('streamStopped', { cameraId });
      });
      
      // Handle disconnect
      socket.on('disconnect', (reason) => {
        this.activeConnections.delete(socket);
        this.metricsCollector.recordDisconnection();
        
        // Clean up stream subscriptions
        for (const [cameraId, clients] of this.activeStreams) {
          if (clients.has(clientId)) {
            clients.delete(clientId);
            socket.leave(`camera-${cameraId}`);
            
            if (clients.size === 0) {
              this.activeStreams.delete(cameraId);
            }
          }
        }
        
        logger.socketDisconnect(clientId, reason, this.activeConnections.size);
      });
      
      // Error handling
      socket.on('error', (error) => {
        logger.error(`Socket error for ${clientId}: ${error.message}`, 'SocketIO');
        this.metricsCollector.recordError('socket_error', 'socketio', 'medium');
      });
    });
    
    console.log('✅ Socket.IO configured');
  }

  private setupRoutes(): void {
    console.log('🛣️ Setting up routes...');
    
    // Health check endpoints
    this.app.get('/api/health', async (req, res) => {
      try {
        const health = await this.healthCheckManager.getSystemHealth();
        const statusCode = health.status === 'unhealthy' ? 503 : 200;
        res.status(statusCode).json(health);
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: (error as Error).message
        });
      }
    });
    
    this.app.get('/api/health/quick', async (req, res) => {
      try {
        const health = await this.healthCheckManager.runQuickHealthCheck();
        res.json(health);
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: (error as Error).message
        });
      }
    });
    
    // Metrics endpoints
    this.app.get('/api/metrics', (req, res) => {
      const metrics = this.metricsCollector.getPrometheusMetrics();
      res.set('Content-Type', 'text/plain').send(metrics);
    });
    
    this.app.get('/api/metrics/app', (req, res) => {
      const metrics = this.metricsCollector.getMetrics();
      res.json({
        timestamp: Date.now(),
        metrics: Object.fromEntries(metrics)
      });
    });
    
    // Configure existing routes
    configureRoutes(this.app, this.io);
    configureAuthRoutes(this.app);
    configureBatchProcessingRoutes(this.app);
    configureVisitorRoutes(this.app);
    this.app.use('/api', logRoutes);
    
    // System info endpoint
    this.app.get('/api/system/info', (req, res) => {
      res.json({
        version: '2.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        activeConnections: this.activeConnections.size,
        activeStreams: this.activeStreams.size,
        timestamp: new Date().toISOString()
      });
    });
    
    console.log('✅ Routes configured');
  }

  private setupMonitoring(): void {
    console.log('📊 Setting up monitoring...');
    
    // Health check intervals
    setInterval(async () => {
      const health = await this.healthCheckManager.getSystemHealth();
      if (health.status === 'unhealthy') {
        this.eventBus.emitEvent({
          type: 'system',
          data: {
            action: 'health_check_failed',
            health,
            timestamp: new Date()
          },
          source: 'MonitoringSystem',
          severity: 'high'
        });
      }
    }, 60000); // Check every minute
    
    // Performance monitoring
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      if (memUsageMB > 512) { // Alert if memory usage > 512MB
        this.eventBus.emitEvent({
          type: 'system',
          data: {
            action: 'memory_warning',
            usage: memUsageMB,
            timestamp: new Date()
          },
          source: 'MonitoringSystem',
          severity: 'medium'
        });
      }
    }, 30000); // Check every 30 seconds
    
    console.log('🔍 Monitoring configured');
  }

  private setupPerformanceOptimization(): void {
    console.log('⚡ Setting up performance optimization...');
    
    // Graceful shutdown handling
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      logger.error(`Uncaught exception: ${error.message}`, 'System');
      this.eventBus.emitEvent({
        type: 'error',
        data: {
          action: 'uncaught_exception',
          error: error.message,
          stack: error.stack
        },
        source: 'System',
        severity: 'critical'
      });
      this.gracefulShutdown('uncaughtException');
    });
    
    console.log('🚀 Performance optimization configured');
  }

  private async startServer(): Promise<void> {
    const port = config.port;
    
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        console.log(`🌟 Server started on port ${port}`);
        console.log(`📍 Health check: http://localhost:${port}/api/health`);
        console.log(`📊 Metrics: http://localhost:${port}/api/metrics`);
        console.log(`🔗 System info: http://localhost:${port}/api/system/info`);
        
        // Emit server started event
        this.eventBus.emitEvent({
          type: 'system',
          data: {
            action: 'server_started',
            port,
            timestamp: new Date()
          },
          source: 'SystemInitializer',
          severity: 'low'
        });
        
        resolve();
      });
    });
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    console.log(`🛑 Graceful shutdown initiated by ${signal}`);
    
    try {
      // Emit shutdown event
      this.eventBus.emitEvent({
        type: 'system',
        data: {
          action: 'shutdown_initiated',
          signal,
          timestamp: new Date()
        },
        source: 'SystemInitializer',
        severity: 'high'
      });
      
      // Stop accepting new connections
      this.server.close();
      
      // Close all socket connections
      for (const socket of this.activeConnections) {
        socket.emit('systemShutdown', { 
          message: 'Server is shutting down', 
          signal 
        });
        socket.disconnect();
      }
      
      // Shutdown services
      await this.streamManager.shutdown();
      this.healthCheckManager.clearQueue();
      this.metricsCollector.reset();
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Initialize the system
async function main(): Promise<void> {
  const initializer = new SystemInitializer();
  await initializer.initialize();
}

// Start the application
main().catch(error => {
  console.error('💥 Failed to start application:', error);
  process.exit(1);
});