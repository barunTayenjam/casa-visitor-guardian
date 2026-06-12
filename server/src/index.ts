import 'reflect-metadata';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { configureRoutes } from './routes/index.js';
import { staticRoutes } from './routes/staticRoutes.js';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { initializeServices, gracefulShutdown } from './bootstrap.js';
import { logger } from './utils/logger.js';

dotenv.config({ path: './.env' });

const app = express();

const corsOrigins = (() => {
  if (process.env.CORS_ORIGIN) return process.env.CORS_ORIGIN.split(',');
  const isDev = process.env.NODE_ENV !== 'production';
  return isDev ? true : ['http://localhost:3000', 'http://localhost:5173'];
})();

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

const go2rtcUrl = process.env.GO2RTC_URL || 'http://go2rtc:1984';
app.use('/go2rtc', createProxyMiddleware({
  target: go2rtcUrl,
  changeOrigin: true,
  pathRewrite: { '^/go2rtc': '' },
}));

app.use(express.json());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      mediaSrc: ["'self'", "blob:", "data:"],
      workerSrc: ["'self'", "blob:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(staticRoutes);

const server = http.createServer(app);

const go2rtcParsed = new URL(go2rtcUrl);
server.on('upgrade', (req, socket, head) => {
  if (!req.url?.startsWith('/go2rtc')) return;

  const targetPath = req.url.replace('/go2rtc', '') || '/';
  const headers: Record<string, string> = {};
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    const key = req.rawHeaders[i].toLowerCase();
    if (key === 'host') {
      headers['host'] = `${go2rtcParsed.hostname}:${go2rtcParsed.port || 1984}`;
    } else {
      headers[req.rawHeaders[i].toLowerCase()] = req.rawHeaders[i + 1];
    }
  }

  const proxyReq = http.request({
    hostname: go2rtcParsed.hostname,
    port: parseInt(go2rtcParsed.port || '1984'),
    path: targetPath,
    method: req.method || 'GET',
    headers,
  });

  proxyReq.on('upgrade', (_proxyRes, proxySocket, proxyHead) => {
    proxySocket.on('error', () => { try { socket.destroy(); } catch {} });
    socket.on('error', () => { try { proxySocket.destroy(); } catch {} });
    socket.on('close', () => { try { proxySocket.destroy(); } catch {} });
    proxySocket.on('close', () => { try { socket.destroy(); } catch {} });

    let responseLine = 'HTTP/1.1 101 Switching Protocols\r\n';
    for (const [k, v] of Object.entries(_proxyRes.headers)) {
      if (v !== undefined) responseLine += `${k}: ${v}\r\n`;
    }
    responseLine += '\r\n';
    socket.write(responseLine);

    if (proxyHead.length > 0) proxySocket.write(proxyHead);
    if (head.length > 0) proxySocket.write(head);

    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on('error', () => { try { socket.destroy(); } catch {} });
  proxyReq.end();
});
const io = new SocketIOServer(server, {
  cors: {
    origin: corsOrigins,
    credentials: true
  }
});

await initializeServices(io);
configureRoutes(app, io);

logger.info('Routes configured successfully', 'SERVER');

// SPA fallback: after all API routes, serve index.html for client-side routing
const frontendDistPath = process.env.FRONTEND_DIST_PATH || path.join(process.cwd(), 'public');
if (fs.existsSync(frontendDistPath)) {
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server, io));
process.on('SIGINT', () => gracefulShutdown('SIGINT', server, io));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', 'SERVER', reason);
});

const PORT = process.env.PORT || 9753;

server.listen(PORT, () => {
  logger.info(`SentryVision Server started on port ${PORT}`, 'SERVER');
});

server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use. Kill the process or change PORT.`, 'SERVER');
    logger.error(`  Run: fuser -k ${PORT}/tcp`, 'SERVER');
    process.exit(1);
  }
  throw error;
});
