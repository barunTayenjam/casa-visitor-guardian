import { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Audit log entry interface
export interface AuditLogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';
  category: 'AUTH' | 'CAMERA' | 'SYSTEM' | 'API' | 'SECURITY' | 'USER' | 'MOTION' | 'CONFIG' | 'VISITOR';
  action: string;
  userId?: string;
  username?: string;
  ip: string;
  userAgent?: string;
  sessionId?: string;
  details?: Record<string, any>;
  success?: boolean;
  errorMessage?: string;
  requestId?: string;
  resourceId?: string;
  resourceType?: string;
  duration?: number;
}

class AuditLogger {
  private logFile: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB

  constructor() {
    const logsDir = path.join(__dirname, '../../logs/audit');
    
    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    this.logFile = path.join(logsDir, `audit-${new Date().toISOString().split('T')[0]}.log`);
  }

  // Rotate log file if it exceeds max size
  private rotateLogFile(): void {
    try {
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.maxFileSize) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const rotatedFile = this.logFile.replace('.log', `-${timestamp}.log`);
          fs.renameSync(this.logFile, rotatedFile);
        }
      }
    } catch (error) {
      logger.error(`Failed to rotate audit log: ${error}`, 'AuditLogger');
    }
  }

  // Write audit entry to file and console
  private writeLog(entry: AuditLogEntry): void {
    this.rotateLogFile();
    
    const logLine = JSON.stringify(entry) + '\n';
    
    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      logger.error(`Failed to write audit log: ${error}`, 'AuditLogger');
    }
    
    // Also log to console with structured format
    const logMessage = `[${entry.level}] ${entry.category}: ${entry.action} - User: ${entry.username || 'anonymous'} (${entry.ip})`;
    
    switch (entry.level) {
      case 'ERROR':
        logger.error(logMessage, 'Audit', entry.details);
        break;
      case 'WARN':
        logger.warn(logMessage, 'Audit');
        break;
      case 'SECURITY':
        logger.error(`[SECURITY] ${logMessage}`, 'Audit');
        break;
      default:
        logger.info(logMessage, 'Audit');
    }
  }

  // Create audit log entry
  log(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    const fullEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      ...entry
    };
    
    this.writeLog(fullEntry);
  }

  // Generic logging method for custom events
  logEvent(action: string, details?: Record<string, any>): void {
    this.log({
      level: 'INFO',
      category: 'USER',
      action,
      ip: 'system',
      details
    });
  }

  // Helper methods to extract request information
  public getClientIP(req: Request): string {
    return req.ip ||
           req.socket?.remoteAddress ||
           'unknown';
  }

  public getUserId(req: Request): string | undefined {
    return req.user?.userId;
  }

  public getUsername(req: Request): string | undefined {
    return req.user?.username;
  }

  public getSessionId(_req: Request): string | undefined {
    return undefined;
  }

  public getRequestId(req: Request): string | undefined {
    return req.get('x-request-id');
  }

  // API operations
  logApi(action: string, req: Request, success: boolean, duration?: number, details?: Record<string, any>): void {
    this.log({
      level: success ? 'INFO' : 'ERROR',
      category: 'API',
      action,
      userId: this.getUserId(req),
      username: this.getUsername(req),
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      sessionId: this.getSessionId(req),
      details,
      success,
      duration,
      requestId: this.getRequestId(req)
    });
  }

  // Middleware for automatic API logging
  auditMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const action = `${req.method} ${req.path}`;
      
      // Generate request ID if not present
      const requestId = req.get('x-request-id') || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      req.headers['x-request-id'] = requestId as string;
      
      const originalSend = res.send;
      
      (res as any).send = function(data: any) {
        const duration = Date.now() - startTime;
        const success = res.statusCode < 400;
        
        auditLogger.logApi(action, req, success, duration, {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          responseSize: data ? Buffer.byteLength(JSON.stringify(data)) : 0
        });
        
        return originalSend.call(this, data);
      };
      
      next();
    };
  }
}

// Create singleton instance
const auditLogger = new AuditLogger();

// Export both instance and middleware
export default auditLogger;
export const auditMiddleware = auditLogger.auditMiddleware.bind(auditLogger);