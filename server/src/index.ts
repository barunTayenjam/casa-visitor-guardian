import 'reflect-metadata';
import express from 'express';
import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { configureRoutes } from './routes/index.js';
import { staticRoutes } from './routes/staticRoutes.js';
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
app.use(express.json());
app.use(helmet());

app.use(staticRoutes);

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: corsOrigins,
    credentials: true
  }
});

await initializeServices(io);
configureRoutes(app, io);

logger.info('Routes configured successfully', 'SERVER');

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
