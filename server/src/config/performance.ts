// Performance and optimization configuration
export const performanceConfig = {
  // Connection limits
  maxConnections: parseInt(process.env.MAX_CONNECTIONS || '100'),
  maxConcurrentStreams: parseInt(process.env.MAX_CONCURRENT_STREAMS || '50'),
  maxDetectionRequests: parseInt(process.env.MAX_DETECTION_REQUESTS || '20'),
  
  // Rate limiting
  apiRateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.API_RATE_LIMIT_MAX || '1000')
  },
  authRateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10')
  },
  streamRateLimit: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: parseInt(process.env.STREAM_RATE_LIMIT_MAX || '30')
  },
  detectionRateLimit: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: parseInt(process.env.DETECTION_RATE_LIMIT_MAX || '20')
  },
  
  // Memory management
  memoryThresholdMB: parseInt(process.env.MEMORY_THRESHOLD_MB || '500'),
  cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '300000'), // 5 minutes
  
  // Caching
  enableCache: process.env.ENABLE_CACHE !== 'false',
  cacheTTL: parseInt(process.env.CACHE_TTL || '3600'), // 1 hour
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  
  // Database
  dbPool: {
    maxConnections: parseInt(process.env.DB_POOL_MAX || '10'),
    idleTimeout: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
    acquireTimeout: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT || '5000')
  },
  
  // Streaming
  streaming: {
    maxFrameBuffer: 3, // frames per camera
    maxFrameSize: 1024 * 1024, // 1MB per frame
    adaptiveQuality: process.env.ADAPTIVE_QUALITY !== 'false',
    maxResolution: process.env.MAX_RESOLUTION || '1920x1080',
    defaultResolution: process.env.DEFAULT_RESOLUTION || '854x480'
  },
  
  // Detection
  detection: {
    maxBatchSize: parseInt(process.env.DETECTION_BATCH_SIZE || '3'), // cameras processed simultaneously
    processingTimeout: parseInt(process.env.DETECTION_TIMEOUT || '30000'), // 30 seconds
    maxQueueSize: parseInt(process.env.DETECTION_QUEUE_MAX || '100'),
    adaptiveScheduling: process.env.ADAPTIVE_SCHEDULING !== 'false'
  },
  
  // Monitoring
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000'), // 1 minute
    alertThresholds: {
      memoryUsage: 0.8, // 80% of threshold
      cpuUsage: 0.8, // 80%
      errorRate: 0.1, // 10%
      responseTime: 5000 // 5 seconds
    }
  },
  
  // Development vs Production
  isDevelopment: process.env.NODE_ENV !== 'production',
  enableDebugLogs: process.env.ENABLE_DEBUG_LOGS !== 'false' && process.env.NODE_ENV !== 'production'
};

export default performanceConfig;