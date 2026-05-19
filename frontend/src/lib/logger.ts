/**
 * Frontend Logger Utility
 * Provides comprehensive logging for the home security frontend application
 */

interface LogMetadata {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  source?: string;
  metadata?: LogMetadata;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
  userAgent: string;
  url: string;
  userId?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private enableConsoleLogging: boolean = true;
  private enableLocalStorage: boolean = true;
  private enableRemoteLogging: boolean = false;
  private remoteEndpoint?: string;
  
  constructor() {
    this.loadLogsFromStorage();
    this.setupErrorHandlers();
    
    // Configure based on environment
    this.enableConsoleLogging = import.meta.env.DEV || localStorage.getItem('enableConsoleLogging') !== 'false';
    this.enableLocalStorage = localStorage.getItem('enableLocalStorage') !== 'false';
    this.enableRemoteLogging = localStorage.getItem('enableRemoteLogging') === 'true';
    this.remoteEndpoint = localStorage.getItem('remoteLogEndpoint') || undefined;
  }
  
  private setupErrorHandlers() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.error('Uncaught error', 'GLOBAL', event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        message: event.message
      });
    });
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', 'GLOBAL', event.reason, {
        type: 'promise'
      });
    });
  }
  
  private createLogEntry(level: LogEntry['level'], message: string, source?: string, error?: unknown, metadata?: LogMetadata): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      source,
      metadata,
      error: error && typeof error === 'object' && error !== null ? {
        name: 'name' in error ? String(error.name) : 'Error',
        message: 'message' in error ? String(error.message) : 'Unknown error',
        stack: 'stack' in error ? String(error.stack) : undefined
      } : undefined,
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getCurrentUserId()
    };
  }
  
  private log(level: LogEntry['level'], message: string, source?: string, error?: unknown, metadata?: LogMetadata) {
    const entry = this.createLogEntry(level, message, source, error, metadata);
    
    // Add to in-memory logs
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Console logging
    if (this.enableConsoleLogging) {
      const consoleMessage = `[${entry.timestamp}] [${level}]${source ? ` [${source}]` : ''} ${message}`;
      const consoleArgs = [consoleMessage];
      
      if (metadata) {
        consoleArgs.push('Metadata:', JSON.stringify(metadata));
      }
      
      if (error) {
        consoleArgs.push('Error:', String(error));
      }
      
      switch (level) {
        case 'ERROR':
          console.error(...consoleArgs);
          break;
        case 'WARN':
          console.warn(...consoleArgs);
          break;
        case 'DEBUG':
          console.debug(...consoleArgs);
          break;
        default:
          console.log(...consoleArgs);
      }
    }
    
    // Local storage
    if (this.enableLocalStorage) {
      this.saveLogsToStorage();
    }
    
    // Remote logging
    if (this.enableRemoteLogging && this.remoteEndpoint) {
      this.sendLogToRemote(entry);
    }
  }
  
  private getCurrentUserId(): string | undefined {
    // Try to get user ID from various sources
    return localStorage.getItem('userId') || 
           sessionStorage.getItem('userId') || 
           ((window as unknown as { currentUser?: { id?: string } }).currentUser)?.id;
  }
  
  private saveLogsToStorage() {
    try {
      const recentLogs = this.logs.slice(-100); // Save only last 100 logs
      localStorage.setItem('frontendLogs', JSON.stringify(recentLogs));
    } catch (error) {
      console.warn('Failed to save logs to localStorage:', error);
    }
  }
  
  private loadLogsFromStorage() {
    try {
      const stored = localStorage.getItem('frontendLogs');
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load logs from localStorage:', error);
    }
  }
  
  private async sendLogToRemote(entry: LogEntry) {
    if (!this.remoteEndpoint) return;
    
    try {
      await fetch(this.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry)
      });
    } catch (error) {
      console.warn('Failed to send log to remote endpoint:', error);
    }
  }
  
  // Public logging methods
  info(message: string, source?: string, metadata?: LogMetadata) {
    this.log('INFO', message, source, undefined, metadata);
  }
  
  warn(message: string, source?: string, metadata?: LogMetadata) {
    this.log('WARN', message, source, undefined, metadata);
  }
  
  error(message: string, source?: string, error?: unknown, metadata?: LogMetadata) {
    this.log('ERROR', message, source, error, metadata);
  }
  
  debug(message: string, source?: string, metadata?: LogMetadata) {
    this.log('DEBUG', message, source, undefined, metadata);
  }
  
  // Specialized logging methods
  apiRequest(method: string, url: string, metadata?: LogMetadata) {
    this.info(`${method} ${url}`, 'API', { method, url, ...metadata });
  }
  
  apiResponse(method: string, url: string, status: number, responseTime?: number, metadata?: LogMetadata) {
    this.info(`${method} ${url} - ${status}`, 'API', { method, url, status, responseTime, ...metadata });
  }
  
  apiError(method: string, url: string, error: unknown, metadata?: LogMetadata) {
    this.error(`${method} ${url} - API Error`, 'API', error, { method, url, ...metadata });
  }
  
  socketEvent(event: string, metadata?: LogMetadata) {
    this.debug(`Socket event: ${event}`, 'SOCKET', { event, ...metadata });
  }
  
  socketError(event: string, error: unknown, metadata?: LogMetadata) {
    this.error(`Socket error: ${event}`, 'SOCKET', error, { event, ...metadata });
  }
  
  userAction(action: string, metadata?: LogMetadata) {
    this.info(`User action: ${action}`, 'USER', { action, ...metadata });
  }
  
  performance(metric: string, value: number, unit?: string, metadata?: LogMetadata) {
    this.debug(`Performance: ${metric} = ${value}${unit ? ' ' + unit : ''}`, 'PERFORMANCE', { metric, value, unit, ...metadata });
  }
  
  cameraAction(action: string, cameraId: string, metadata?: LogMetadata) {
    this.info(`Camera action: ${action} for camera ${cameraId}`, 'CAMERA', { action, cameraId, ...metadata });
  }
  
  // Utility methods
  getLogs(filter?: Partial<LogEntry>): LogEntry[] {
    if (!filter) return [...this.logs];
    
    return this.logs.filter(log => {
      if (filter.level && log.level !== filter.level) return false;
      if (filter.source && log.source !== filter.source) return false;
      if (filter.level && log.level !== filter.level) return false;
      return true;
    });
  }
  
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }
  
  clearLogs() {
    this.logs = [];
    localStorage.removeItem('frontendLogs');
  }
  
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
  
  // Configuration methods
  configure(config: {
    enableConsoleLogging?: boolean;
    enableLocalStorage?: boolean;
    enableRemoteLogging?: boolean;
    remoteEndpoint?: string;
    maxLogs?: number;
  }) {
    if (config.enableConsoleLogging !== undefined) {
      this.enableConsoleLogging = config.enableConsoleLogging;
      localStorage.setItem('enableConsoleLogging', config.enableConsoleLogging.toString());
    }
    
    if (config.enableLocalStorage !== undefined) {
      this.enableLocalStorage = config.enableLocalStorage;
      localStorage.setItem('enableLocalStorage', config.enableLocalStorage.toString());
    }
    
    if (config.enableRemoteLogging !== undefined) {
      this.enableRemoteLogging = config.enableRemoteLogging;
      localStorage.setItem('enableRemoteLogging', config.enableRemoteLogging.toString());
    }
    
    if (config.remoteEndpoint !== undefined) {
      this.remoteEndpoint = config.remoteEndpoint;
      localStorage.setItem('remoteLogEndpoint', config.remoteEndpoint || '');
    }
    
    if (config.maxLogs !== undefined) {
      this.maxLogs = config.maxLogs;
    }
  }
  
  getConfiguration() {
    return {
      enableConsoleLogging: this.enableConsoleLogging,
      enableLocalStorage: this.enableLocalStorage,
      enableRemoteLogging: this.enableRemoteLogging,
      remoteEndpoint: this.remoteEndpoint,
      maxLogs: this.maxLogs,
      totalLogs: this.logs.length
    };
  }
}

// Create singleton instance
export const logger = new Logger();

// Export types for TypeScript users
export type { LogMetadata, LogEntry };
export { Logger };