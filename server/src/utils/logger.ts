

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import log database
import { getLogDatabase } from '../services/logDatabase.js';

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file paths
const errorLogFile = path.join(logsDir, 'error.log');
const combinedLogFile = path.join(logsDir, 'combined.log');
const accessLogFile = path.join(logsDir, 'access.log');

// Store original console methods before overriding
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleDebug = console.debug;

// Configuration to control logging levels
const LOGGING_CONFIG = {
  enableInfo: true,       // Enable info logs for debugging
  enableWarn: true,       // Keep warnings
  enableError: true,      // Keep errors
  enableDebug: true,      // Enable debug logs
  enableServerStart: true, // Keep server start messages
  enableMotionEvents: true, // Enable motion detection logs
  enableStreamLogs: true,   // Enable stream logs
  enableSocketLogs: true,   // Enable socket logs
  enableFileLogging: true,  // Enable file logging
  enableDatabaseLogging: true, // Enable database logging
  maxLogFileSize: 10 * 1024 * 1024, // 10MB max file size
  maxLogFiles: 5 // Keep 5 log files max
};

// File logging utility
const writeToFile = (filePath: string, message: string) => {
  if (!LOGGING_CONFIG.enableFileLogging) return;
  
  try {
    // Check file size and rotate if necessary
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > LOGGING_CONFIG.maxLogFileSize) {
        // Rotate log file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = filePath.replace('.log', `-${timestamp}.log`);
        fs.renameSync(filePath, rotatedPath);
        
        // Clean up old log files
        const dir = path.dirname(filePath);
        const baseName = path.basename(filePath, '.log');
        const files = fs.readdirSync(dir)
          .filter(f => f.startsWith(baseName) && f.includes('-'))
          .map(f => ({ name: f, path: path.join(dir, f) }))
          .sort((a, b) => {
            const statA = fs.statSync(a.path);
            const statB = fs.statSync(b.path);
            return statB.mtime.getTime() - statA.mtime.getTime();
          });
        
        // Remove old files beyond the limit
        if (files.length > LOGGING_CONFIG.maxLogFiles) {
          files.slice(LOGGING_CONFIG.maxLogFiles).forEach(file => {
            fs.unlinkSync(file.path);
          });
        }
      }
    }
    
    fs.appendFileSync(filePath, message + '\n');
  } catch (error) {
    // If file logging fails, still log to console
    originalConsoleError('Failed to write to log file:', error);
  }
};

// Database logging utility
const writeToDatabase = async (
  level: string,
  message: string,
  source?: string,
  error?: unknown,
  metadata?: Record<string, unknown>
) => {
  if (!LOGGING_CONFIG.enableDatabaseLogging) return;
  
  try {
    const logDb = await getLogDatabase();
    if (!logDb || !logDb.pool) {
      // Database not yet initialized, skip database logging
      return;
    }
    
    const errorDetails = error ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2) : undefined;
    const metadataStr = metadata ? JSON.stringify(metadata) : undefined;
    
    await logDb.insertLog({
      timestamp: new Date().toISOString(),
      level: level as 'info' | 'warn' | 'error' | 'debug',
      message,
      source,
      error_details: errorDetails,
      metadata: metadataStr
    });
  } catch (dbError) {
    // If database logging fails, log to console but don't crash
    originalConsoleError('Failed to write to log database:', dbError);
  }
};

const log = (level: string, message: string, source?: string, error?: unknown, metadata?: Record<string, unknown>) => {
  // Check if this type of log should be shown
  if (level === 'info' && !LOGGING_CONFIG.enableInfo) {
    // Special cases for important info logs
    if (source === 'SERVER' && LOGGING_CONFIG.enableServerStart) {
      // Allow server start messages
    } else if (source === 'STREAM' && !LOGGING_CONFIG.enableStreamLogs) {
      return; // Skip stream logs
    } else if (source === 'SOCKET' && !LOGGING_CONFIG.enableSocketLogs) {
      return; // Skip socket logs
    } else if (!LOGGING_CONFIG.enableInfo) {
      return; // Skip other info logs
    }
  }
  
  if (level === 'warn' && !LOGGING_CONFIG.enableWarn) return;
  if (level === 'error' && !LOGGING_CONFIG.enableError) return;
  if (level === 'debug' && !LOGGING_CONFIG.enableDebug) return;
  
  const timestamp = new Date().toISOString();
  const sourceStr = source ? ` [${source}]` : '';
  const metadataStr = metadata ? ` METADATA: ${JSON.stringify(metadata)}` : '';
  const errorStr = error ? ` ERROR_DETAILS: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}` : '';
  const logMessage = `[${timestamp}] [${level.toUpperCase()}]${sourceStr} ${message}${metadataStr}${errorStr}`;
  
  // Write to console using original methods to avoid recursion
  if (level === 'error') {
    originalConsoleError(logMessage);
    writeToFile(errorLogFile, logMessage);
  } else if (level === 'warn') {
    originalConsoleWarn(logMessage);
  } else if (level === 'debug') {
    originalConsoleDebug(logMessage);
  } else {
    originalConsoleLog(logMessage);
  }
  
  // Write all logs to combined log file
  writeToFile(combinedLogFile, logMessage);
  
  // Write access logs separately
  if (source === 'API' || source === 'SOCKET') {
    writeToFile(accessLogFile, logMessage);
  }

  // Write to database (async, don't block)
  writeToDatabase(level, message, source, error, metadata);
};

// Override console methods to also log to file

console.log = (...args: any[]) => {
  originalConsoleLog(...args);
};

console.error = (...args: any[]) => {
  originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
  originalConsoleWarn(...args);
};

console.debug = (...args: any[]) => {
  originalConsoleDebug(...args);
};

export const logger = {
  info: (message: string, source?: string, metadata?: Record<string, unknown>) => log('info', message, source, undefined, metadata),
  warn: (message: string, source?: string, metadata?: Record<string, unknown>) => log('warn', message, source, undefined, metadata),
  error: (message: string, source?: string, error?: unknown, metadata?: Record<string, unknown>) => log('error', message, source, error, metadata),
  debug: (message: string, source?: string, metadata?: Record<string, unknown>) => log('debug', message, source, undefined, metadata),
  
  // Helper methods for socket events
  socketConnect: (socketId: string, address: string, totalClients: number) => {
    log('info', `New client connected: ${socketId} from: ${address} Total connected clients: ${totalClients}`, 'SOCKET', undefined, { socketId, address, totalClients });
  },
  
  socketDisconnect: (socketId: string, reason: string, totalClients: number) => {
    log('info', `Client disconnected: ${socketId} Reason: ${reason} Total connected clients: ${totalClients}`, 'SOCKET', undefined, { socketId, reason, totalClients });
  },
  
  socketError: (socketId: string, error: unknown) => {
    log('error', `Socket error for client ${socketId}`, 'SOCKET', error, { socketId });
  },
  
  streamRequest: (cameraId: string, socketId: string) => {
    log('info', `Stream requested for camera ${cameraId} from client ${socketId}`, 'STREAM', undefined, { cameraId, socketId });
  },
  
  streamStop: (cameraId: string, socketId: string) => {
    log('info', `Stream stopped for camera ${cameraId} from client ${socketId}`, 'STREAM', undefined, { cameraId, socketId });
  },
  
  serverStart: (port: number) => {
    log('info', `*** SERVER STARTED ON PORT ${port} ***`, 'SERVER', undefined, { port });
  },
  
  corsBlock: (origin: string, type: 'socket' | 'http') => {
    log('warn', `Blocked ${type} request from origin: ${origin}`, 'CORS', undefined, { origin, type });
  },
  
  // API request logging
  apiRequest: (method: string, url: string, ip: string, userAgent?: string) => {
    log('info', `${method} ${url}`, 'API', undefined, { method, url, ip, userAgent });
  },
  
  apiResponse: (method: string, url: string, statusCode: number, responseTime?: number) => {
    log('info', `${method} ${url} - ${statusCode}`, 'API', undefined, { method, url, statusCode, responseTime });
  },
  
  apiError: (method: string, url: string, error: Error, statusCode?: number) => {
    log('error', `${method} ${url} - Error: ${error.message}`, 'API', error, { method, url, statusCode });
  },
  
  // Motion detection logging
  motionDetected: (cameraId: string, confidence: number, timestamp?: string) => {
    log('info', `Motion detected on camera ${cameraId} with confidence ${confidence}`, 'MOTION', undefined, { cameraId, confidence, timestamp });
  },
  
  motionError: (cameraId: string, error: unknown) => {
    log('error', `Motion detection error on camera ${cameraId}`, 'MOTION', error, { cameraId });
  },
  
  // System performance logging
  performance: (metric: string, value: number, unit?: string) => {
    log('info', `Performance: ${metric} = ${value}${unit ? ' ' + unit : ''}`, 'PERFORMANCE', undefined, { metric, value, unit });
  },
  
  memoryUsage: (heapUsed: number, heapTotal: number, external: number) => {
    log('debug', `Memory usage: ${Math.round(heapUsed / 1024 / 1024)}MB used, ${Math.round(heapTotal / 1024 / 1024)}MB total`, 'MEMORY', undefined, { heapUsed, heapTotal, external });
  }
};


