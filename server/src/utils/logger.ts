

// Create logs directory if it doesn't exist


// Store original console methods before overriding
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleDebug = console.debug;

const log = (level: string, message: string, source?: string, error?: any) => {
  const timestamp = new Date().toISOString();
  const sourceStr = source ? ` [${source}]` : '';
  const errorStr = error ? ` ERROR_DETAILS: ${JSON.stringify(error, null, 2)}` : '';
  const logMessage = `[${timestamp}] [${level.toUpperCase()}]${sourceStr} ${message}${errorStr}`;
  
  // Write to console using original methods to avoid recursion
  if (level === 'error') {
    originalConsoleError(logMessage);
  } else if (level === 'warn') {
    originalConsoleWarn(logMessage);
  } else if (level === 'debug') {
    originalConsoleDebug(logMessage);
  } else {
    originalConsoleLog(logMessage);
  }
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


