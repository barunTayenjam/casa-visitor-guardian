import { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Audit log entry interface
export interface AuditLogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';
  category: 'AUTH' | 'CAMERA' | 'SYSTEM' | 'API' | 'SECURITY' | 'USER' | 'MOTION' | 'CONFIG';
  action: string;
  userId?: string;
  username?: string;
  ip: string;
  userAgent?: string;
  sessionId?: string;
  resourceId?: string;
  resourceType?: string;
  details?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  duration?: number;
  requestId?: string;
}

// Audit logger class
export class AuditLogger {
  private logFile: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private maxFiles: number = 5;

  constructor() {
    const auditDir = path.join(__dirname, '../../logs/audit');
    if (!fs.existsSync(auditDir)) {
      fs.mkdirSync(auditDir, { recursive: true });
    }
    this.logFile = path.join(auditDir, `audit-${new Date().toISOString().split('T')[0]}.log`);
  }

  // Rotate log file if it gets too large
  private rotateLogFile(): void {
    try {
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.maxFileSize) {
          // Rotate existing files
          for (let i = this.maxFiles - 1; i > 0; i--) {
            const oldFile = this.logFile.replace('.log', `.${i}.log`);
            const newFile = this.logFile.replace('.log', `.${i + 1}.log`);
            if (fs.existsSync(oldFile)) {
              if (i === this.maxFiles - 1) {
                fs.unlinkSync(oldFile); // Delete oldest file
              } else {
                fs.renameSync(oldFile, newFile);
              }
            }
          }
          // Move current file to .1.log
          fs.renameSync(this.logFile, this.logFile.replace('.log', '.1.log'));
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

  // Authentication events
  logAuth(action: string, req: Request, success: boolean, userId?: string, username?: string, details?: Record<string, any>): void {
    this.log({
      level: success ? 'INFO' : 'WARN',
      category: 'AUTH',
      action,
      userId,
      username,
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      sessionId: this.getSessionId(req),
      details,
      success,
      requestId: this.getRequestId(req)
    });
  }

  // Security events
  logSecurity(action: string, req: Request, details: Record<string, any>, errorMessage?: string): void {
    this.log({
      level: 'SECURITY',
      category: 'SECURITY',
      action,
      userId: this.getUserId(req),
      username: this.getUsername(req),
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      sessionId: this.getSessionId(req),
      details,
      success: false,
      errorMessage,
      requestId: this.getRequestId(req)
    });
  }

  // Camera operations
  logCamera(action: string, req: Request, cameraId: string, success: boolean, details?: Record<string, any>): void {
    this.log({
      level: success ? 'INFO' : 'ERROR',
      category: 'CAMERA',
      action,
      userId: this.getUserId(req),
      username: this.getUsername(req),
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      sessionId: this.getSessionId(req),
      resourceId: cameraId,
      resourceType: 'camera',
      details,
      success,
      requestId: this.getRequestId(req)
    });
  }

  // System operations
  logSystem(action: string, req: Request, success: boolean, details?: Record<string, any>): void {
    this.log({
      level: success ? 'INFO' : 'ERROR',
      category: 'SYSTEM',
      action,
      userId: this.getUserId(req),
      username: this.getUsername(req),
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      sessionId: this.getSessionId(req),
      details,
      success,
      requestId: this.getRequestId(req)
    });
  }

  // API operations
  logApi(action: string, req: Request, success: boolean, duration?: number, details?: Record<string, any>): void {
    this.log({
      level: success ? 'INFO' : 'WARN',
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

  // Motion detection events
  logMotion(action: string, cameraId: string, details: Record<string, any>): void {
    this.log({
      level: 'INFO',
      category: 'MOTION',
      action,
      ip: 'system',
      resourceId: cameraId,
      resourceType: 'camera',
      details,
      success: true
    });
  }

  // Configuration changes
  logConfig(action: string, req: Request, success: boolean, details?: Record<string, any>): void {
    this.log({
      level: success ? 'INFO' : 'ERROR',
      category: 'CONFIG',
      action,
      userId: this.getUserId(req),
      username: this.getUsername(req),
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      sessionId: this.getSessionId(req),
      details,
      success,
      requestId: this.getRequestId(req)
    });
  }

  // Helper methods to extract information from request
  private getClientIP(req: Request): string {
    return req.ip || 
           req.get('x-forwarded-for')?.split(',')[0]?.trim() || 
           req.get('x-real-ip') || 
           req.connection.remoteAddress || 
           'unknown';
  }

  private getUserId(req: Request): string | undefined {
    return (req as any).user?.userId;
  }

  private getUsername(req: Request): string | undefined {
    return (req as any).user?.username;
  }

  private getSessionId(req: Request): string | undefined {
    return (req as any).sessionID || req.get('x-session-id');
  }

  private getRequestId(req: Request): string | undefined {
    return req.get('x-request-id') || (req as any).requestId;
  }

  // Query audit logs
  async queryLogs(filters: {
    startDate?: Date;
    endDate?: Date;
    level?: string;
    category?: string;
    userId?: string;
    action?: string;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    const logs: AuditLogEntry[] = [];
    const auditDir = path.join(__dirname, '../../logs/audit');
    
    try {
      const files = fs.readdirSync(auditDir)
        .filter(file => file.endsWith('.log'))
        .sort()
        .reverse(); // Most recent first
      
      for (const file of files) {
        const filePath = path.join(auditDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const entry: AuditLogEntry = JSON.parse(line);
            
            // Apply filters
            if (filters.startDate && new Date(entry.timestamp) < filters.startDate) continue;
            if (filters.endDate && new Date(entry.timestamp) > filters.endDate) continue;
            if (filters.level && entry.level !== filters.level) continue;
            if (filters.category && entry.category !== filters.category) continue;
            if (filters.userId && entry.userId !== filters.userId) continue;
            if (filters.action && !entry.action.includes(filters.action)) continue;
            
            logs.push(entry);
            
            if (filters.limit && logs.length >= filters.limit) {
              return logs;
            }
          } catch (error) {
            logger.warn(`Failed to parse audit log line: ${line}`, 'AuditLogger');
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to query audit logs: ${error}`, 'AuditLogger');
    }
    
    return logs;
  }

  // Get audit statistics
  async getStatistics(days: number = 7): Promise<Record<string, any>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const logs = await this.queryLogs({ startDate });
    
    const stats = {
      totalLogs: logs.length,
      byLevel: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      byAction: {} as Record<string, number>,
      topIPs: {} as Record<string, number>,
      securityEvents: 0,
      failedAuth: 0
    };
    
    for (const log of logs) {
      // Count by level
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      
      // Count by category
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
      
      // Count by action
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
      
      // Count by IP
      stats.topIPs[log.ip] = (stats.topIPs[log.ip] || 0) + 1;
      
      // Count security events
      if (log.level === 'SECURITY') {
        stats.securityEvents++;
      }
      
      // Count failed authentication
      if (log.category === 'AUTH' && !log.success) {
        stats.failedAuth++;
      }
    }
    
    // Sort top IPs
    const sortedIPs = Object.entries(stats.topIPs)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    stats.topIPs = Object.fromEntries(sortedIPs);
    
    return stats;
  }
}

// Create singleton instance
export const auditLogger = new AuditLogger();

// Middleware for automatic audit logging
export function auditMiddleware(action: string, category: AuditLogEntry['category']) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;
    
    // Generate request ID if not present
    const requestId = req.get('x-request-id') || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.headers['x-request-id'] = requestId;
    
    res.send = function(data: any) {
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

export default auditLogger;