import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'server.log');
const errorLogFilePath = path.join(logsDir, 'error.log');

// Ensure log files exist
if (!fs.existsSync(logFilePath)) {
  fs.writeFileSync(logFilePath, '');
}
if (!fs.existsSync(errorLogFilePath)) {
  fs.writeFileSync(errorLogFilePath, '');
}

// Store original console methods before overriding
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleDebug = console.debug;

const log = (level: string, message: string, source?: string, error?: any) => {
  const timestamp = new Date().toISOString();
  const sourceStr = source ? ` [${source}]` : '';
  const errorStr = error ? ` ERROR_DETAILS: ${JSON.stringify(error, null, 2)}` : '';
  const logMessage = `[${timestamp}] [${level.toUpperCase()}]${sourceStr} ${message}${errorStr}\n`;
  
  // Write to console using original methods to avoid recursion
  if (level === 'error') {
    originalConsoleError(logMessage.trim());
  } else if (level === 'warn') {
    originalConsoleWarn(logMessage.trim());
  } else if (level === 'debug') {
    originalConsoleDebug(logMessage.trim());
  } else {
    originalConsoleLog(logMessage.trim());
  }
  
  // Write to main log file
  fs.appendFile(logFilePath, logMessage, (err) => {
    if (err) {
      originalConsoleError('Failed to write to main log file:', err);
    }
  });
  
  // Write errors to separate error log file
  if (level === 'error') {
    fs.appendFile(errorLogFilePath, logMessage, (err) => {
      if (err) {
        originalConsoleError('Failed to write to error log file:', err);
      }
    });
  }
};

// Override console methods to also log to file

console.log = (...args: any[]) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  // Write directly to file to avoid recursion
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [INFO] [CONSOLE] ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage);
  originalConsoleLog(...args);
};

console.error = (...args: any[]) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  // Write directly to file to avoid recursion
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [ERROR] [CONSOLE] ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage);
  fs.appendFileSync(errorLogFilePath, logMessage);
  originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  // Write directly to file to avoid recursion
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [WARN] [CONSOLE] ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage);
  originalConsoleWarn(...args);
};

console.debug = (...args: any[]) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  // Write directly to file to avoid recursion
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [DEBUG] [CONSOLE] ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage);
  originalConsoleDebug(...args);
};

export const logger = {
  info: (message: string, source?: string) => log('info', message, source),
  warn: (message: string, source?: string) => log('warn', message, source),
  error: (message: string, source?: string, error?: any) => log('error', message, source, error),
  debug: (message: string, source?: string) => log('debug', message, source),
  
  // Helper methods for socket events
  socketConnect: (socketId: string, address: string, totalClients: number) => {
    log('info', `New client connected: ${socketId} from: ${address} Total connected clients: ${totalClients}`, 'SOCKET');
  },
  
  socketDisconnect: (socketId: string, reason: string, totalClients: number) => {
    log('info', `Client disconnected: ${socketId} Reason: ${reason} Total connected clients: ${totalClients}`, 'SOCKET');
  },
  
  socketError: (socketId: string, error: any) => {
    log('error', `Socket error for client ${socketId}`, 'SOCKET', error);
  },
  
  streamRequest: (cameraId: string, socketId: string) => {
    log('info', `Stream requested for camera ${cameraId} from client ${socketId}`, 'STREAM');
  },
  
  streamStop: (cameraId: string, socketId: string) => {
    log('info', `Stream stopped for camera ${cameraId} from client ${socketId}`, 'STREAM');
  },
  
  serverStart: (port: number) => {
    log('info', `*** SERVER STARTED ON PORT ${port} ***`, 'SERVER');
  },
  
  corsBlock: (origin: string, type: 'socket' | 'http') => {
    log('warn', `Blocked ${type} request from origin: ${origin}`, 'CORS');
  }
};