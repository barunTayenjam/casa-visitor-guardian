import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { Response } from 'express';
import { logger } from '../utils/logger.js';
import { EventBus } from '../events/eventBus.js';
import { BaseService } from '../services/baseService.js';
import { config, getCameraById } from '../config/index.js';

// Import ffmpeg-static safely
import ffmpegStatic from "ffmpeg-static";
const ffmpegPath = ffmpegStatic as unknown as string;

export interface StreamStats {
  activeStreams: number;
  totalFramesProcessed: number;
  errorsCount: number;
  uptime: number;
  lastActivity: Date;
}

export interface StreamConfig {
  cameraId: string;
  rtspUrl: string;
  username?: string;
  password?: string;
  frameRate: number;
  resolution: string;
  nightMode: boolean;
  quality: number; // 1-31 (lower = higher quality)
  maxBitrate?: number;
  timeout?: number;
}

export class EnhancedStreamManager extends BaseService {
  private activeStreams = new Map<string, ChildProcess>();
  private streamTimeouts = new Map<string, NodeJS.Timeout>();
  private streamStats = new Map<string, StreamStats>();
  private readonly MAX_STREAM_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly CLEANUP_INTERVAL = 30 * 1000; // 30 seconds
  private readonly MAX_RETRIES = 5; // More retries for gentle connection
  private readonly RETRY_DELAY = 10000; // 10 seconds (longer delay to avoid overwhelming)

  constructor() {
    super('EnhancedStreamManager');
    this.startCleanupTimer();
    this.setupEventHandlers();
  }

  protected setupEventHandlers(): void {
    // Handle system shutdown gracefully
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
    process.on('beforeExit', () => this.shutdown());

    // Listen for camera status changes
    this.eventBus.on('camera', this.handleCameraEvent.bind(this));
    
    // Listen for system events
    this.eventBus.on('system', this.handleSystemEvent.bind(this));
  }

  private handleCameraEvent(event: any): void {
    if (event.data.status === 'offline') {
      this.cleanupStream(event.data.cameraId);
    }
  }

  private handleSystemEvent(event: any): void {
    if (event.data.action === 'shutdown') {
      this.shutdown();
    }
  }

  async createStream(streamConfig: StreamConfig, res?: Response): Promise<boolean> {
    try {
      // Clean up existing stream if any
      this.cleanupStream(streamConfig.cameraId);

      const ffmpegArgs = this.buildFFmpegArgs(streamConfig);
      this.logInfo(`Starting stream for camera ${streamConfig.cameraId}`, {
        args: ffmpegArgs,
        config: { ...streamConfig, password: '***' }
      });

      const ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          FFREPORT: `file=${streamConfig.cameraId}_report.log:level=32`
        }
      });

      // Store stream reference
      this.activeStreams.set(streamConfig.cameraId, ffmpeg);
      
      // Initialize stream stats
      this.streamStats.set(streamConfig.cameraId, {
        activeStreams: 1,
        totalFramesProcessed: 0,
        errorsCount: 0,
        uptime: Date.now(),
        lastActivity: new Date()
      });
      
      // Set auto-cleanup timeout
      const timeout = setTimeout(() => {
        this.logWarn(`Stream timeout for camera ${streamConfig.cameraId}, cleaning up`);
        this.cleanupStream(streamConfig.cameraId);
      }, this.MAX_STREAM_DURATION);
      
      this.streamTimeouts.set(streamConfig.cameraId, timeout);

      // Handle process events
      this.setupProcessHandlers(streamConfig.cameraId, ffmpeg, res);

      // Emit stream started event
      await this.emitServiceEvent('camera', {
        cameraId: streamConfig.cameraId,
        status: 'online',
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this.logError(error as Error, { 
        cameraId: streamConfig.cameraId,
        operation: 'createStream' 
      });
      
      await this.emitServiceEvent('camera', {
        cameraId: streamConfig.cameraId,
        status: 'error',
        error: (error as Error).message,
        timestamp: new Date()
      });

      return false;
    }
  }

  private buildFFmpegArgs(config: StreamConfig): string[] {
    const args = [
      // Input options - gentle settings to avoid overwhelming cameras
      '-loglevel', 'error',
      '-rtsp_transport', 'tcp',
      '-timeout', String(config.timeout || 30000000), // 30 seconds timeout (longer for gentle connection)
      '-rtsp_flags', 'prefer_tcp',
      '-fflags', '+discardcorrupt',
      '-err_detect', 'ignore_err',
      '-re', // Read input at native frame rate
      '-thread_queue_size', '512', // Smaller queue to reduce buffering
      
      // Analysis options - reduced to be gentler
      '-probesize', '1000000', // 1MB (reduced from 5MB)
      '-analyzeduration', '1000000', // 1 second (reduced from 3 seconds)
      '-max_delay', '500000', // 500ms (increased for stability)
      
      // Input source
      '-i', this.buildAuthenticatedUrl(config),
      
      // Output options - gentle encoding
      '-f', 'mjpeg',
      '-pix_fmt', 'yuvj420p',
      '-vcodec', 'mjpeg',
      '-q:v', String(config.quality || 5), // Slightly lower quality (5 instead of 3) for less processing
      '-r', String(config.frameRate),
      '-movflags', 'frag_keyframe+empty_moov',
      '-flush_packets', '1', // Flush packets immediately for lower latency
    ];

    // Add video filter
    const filters = [];
    filters.push(`scale=${config.resolution.split('x')[0] || 854}:${config.resolution.split('x')[1] || 480}`);
    
    if (config.nightMode) {
      filters.push('eq=gamma=1.5:contrast=1.2:brightness=0.2');
    }

    if (filters.length > 0) {
      args.push('-vf', filters.join(','));
    }

    // Add bitrate control if specified
    if (config.maxBitrate) {
      args.push('-b:v', `${config.maxBitrate}k`);
      args.push('-maxrate', `${config.maxBitrate}k`);
      args.push('-bufsize', `${config.maxBitrate * 2}k`);
    }

    args.push('pipe:1');
    return args;
  }

  private buildAuthenticatedUrl(config: StreamConfig): string {
    if (config.username && config.password) {
      const urlParts = config.rtspUrl.split('://');
      if (urlParts.length === 2) {
        const encodedUsername = encodeURIComponent(config.username);
        const encodedPassword = encodeURIComponent(config.password);
        return `${urlParts[0]}://${encodedUsername}:${encodedPassword}@${urlParts[1]}`;
      }
    }
    return config.rtspUrl;
  }

  private setupProcessHandlers(
    cameraId: string, 
    ffmpeg: ChildProcess, 
    res?: Response
  ): void {
    let frameCount = 0;
    let lastErrorTime = 0;

    // Handle stdout (video frames)
    ffmpeg.stdout?.on('data', (chunk: Buffer) => {
      frameCount++;
      
      // Update stats
      const stats = this.streamStats.get(cameraId);
      if (stats) {
        stats.totalFramesProcessed = frameCount;
        stats.lastActivity = new Date();
      }

      // Emit frame if response is provided (HTTP streaming)
      if (res && !res.writableEnded) {
        res.write(chunk);
      }

      // Emit frame event for WebSocket clients
      this.eventBus.emit('frame', {
        cameraId,
        data: chunk.toString('base64'),
        timestamp: new Date(),
        frameNumber: frameCount
      });
    });

    // Handle stderr (errors and logs)
    ffmpeg.stderr?.on('data', (data: Buffer) => {
      const message = data.toString();
      const now = Date.now();
      
      // Prevent error flooding
      if (now - lastErrorTime < 1000) {
        return;
      }
      lastErrorTime = now;

      // Update error stats
      const stats = this.streamStats.get(cameraId);
      if (stats) {
        stats.errorsCount++;
      }

      // Log specific error types
      if (message.includes('Connection refused') || message.includes('Network is unreachable')) {
        this.logWarn(`Camera ${cameraId} network error: ${message.trim()}`);
      } else if (message.includes('Authentication failed')) {
        this.logError(new Error(`Camera ${cameraId} authentication failed: ${message.trim()}`));
      } else if (message.includes('401')) {
        this.logError(new Error(`Camera ${cameraId} unauthorized (401): ${message.trim()}`));
      } else {
        this.logDebug(`Camera ${cameraId} stderr: ${message.trim()}`);
      }
    });

    // Handle process exit
    ffmpeg.on('close', (code: number | null, signal: string | null) => {
      this.logInfo(`FFmpeg process for camera ${cameraId} exited`, {
        code,
        signal,
        frameCount
      });

      // Clean up stream
      this.cleanupStream(cameraId);

      // Emit stream ended event
      this.eventBus.emitEvent({
        type: 'camera',
        data: {
          cameraId,
          status: 'offline',
          reason: code !== 0 ? `exit code ${code}` : `signal ${signal}`,
          frameCount,
          timestamp: new Date()
        }
      });

      // End HTTP response if provided
      if (res && !res.writableEnded) {
        res.end();
      }

      // Auto-restart if it was an unexpected exit
      if (code !== 0 && code !== null) {
        this.attemptStreamRestart(cameraId);
      }
    });

    // Handle process error
    ffmpeg.on('error', (error: Error) => {
      this.logError(error, { cameraId, operation: 'ffmpeg_process' });
      this.cleanupStream(cameraId);

      // Emit stream error event
      this.eventBus.emitEvent({
        type: 'error',
        data: {
          cameraId,
          error: error.message,
          operation: 'stream_creation',
          timestamp: new Date()
        },
        severity: 'high',
        source: this.serviceName
      });

      if (res && !res.writableEnded) {
        res.status(500).end();
      }
    });
  }

  private async attemptStreamRestart(cameraId: string): Promise<void> {
    const camera = getCameraById(cameraId);
    if (!camera) {
      this.logWarn(`Cannot restart stream for unknown camera: ${cameraId}`);
      return;
    }

    const stats = this.streamStats.get(cameraId);
    const retryCount = stats?.errorsCount || 0;

    if (retryCount >= this.MAX_RETRIES) {
      this.logWarn(`Camera ${cameraId} exceeded max retry attempts, giving up`);
      return;
    }

    const delay = this.RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
    this.logInfo(`Attempting to restart stream for camera ${cameraId} in ${delay}ms (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);

    setTimeout(async () => {
      const streamConfig: StreamConfig = {
        cameraId: camera.id,
        rtspUrl: camera.rtspUrl,
        username: camera.username,
        password: camera.password,
        frameRate: camera.frameRate,
        resolution: camera.resolution,
        nightMode: camera.nightMode,
        quality: 3
      };

      await this.createStream(streamConfig);
    }, delay);
  }

  private cleanupStream(cameraId: string): void {
    // Clear timeout
    const timeout = this.streamTimeouts.get(cameraId);
    if (timeout) {
      clearTimeout(timeout);
      this.streamTimeouts.delete(cameraId);
    }

    // Kill ffmpeg process
    const process = this.activeStreams.get(cameraId);
    if (process) {
      try {
        process.kill('SIGTERM');
        
        // Force kill if graceful shutdown fails
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
      } catch (error) {
        this.logWarn(`Failed to kill process for camera ${cameraId}:`, error);
      }
      
      this.activeStreams.delete(cameraId);
    }

    // Update stats
    const stats = this.streamStats.get(cameraId);
    if (stats) {
      stats.activeStreams = 0;
    }
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredStreams();
    }, this.CLEANUP_INTERVAL);
  }

  private cleanupExpiredStreams(): void {
    const now = Date.now();
    
    for (const [cameraId, stats] of this.streamStats) {
      // Clean up streams that have been inactive for too long
      const inactiveTime = now - stats.lastActivity.getTime();
      if (inactiveTime > this.MAX_STREAM_DURATION && stats.activeStreams > 0) {
        this.logWarn(`Cleaning up inactive stream for camera ${cameraId}`);
        this.cleanupStream(cameraId);
      }
    }
  }

  // Public API methods
  getStreamStats(): Map<string, StreamStats> {
    return new Map(this.streamStats);
  }

  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  isStreamActive(cameraId: string): boolean {
    return this.activeStreams.has(cameraId);
  }

  async stopStream(cameraId: string): Promise<boolean> {
    try {
      this.logInfo(`Manually stopping stream for camera ${cameraId}`);
      this.cleanupStream(cameraId);
      
      // Emit stream stopped event
      await this.emitServiceEvent('camera', {
        cameraId,
        status: 'offline',
        reason: 'manual_stop',
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this.logError(error as Error, { cameraId, operation: 'stopStream' });
      return false;
    }
  }

  async shutdown(): Promise<void> {
    this.logInfo('Shutting down EnhancedStreamManager...');
    
    // Stop all active streams
    for (const cameraId of this.activeStreams.keys()) {
      this.cleanupStream(cameraId);
    }

    // Clear all timeouts
    for (const timeout of this.streamTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.streamTimeouts.clear();

    // Clear collections
    this.activeStreams.clear();
    this.streamStats.clear();

    this.logInfo('EnhancedStreamManager shutdown complete');
  }

  // Method to get system metrics
  getSystemMetrics(): {
    activeStreams: number;
    totalFramesProcessed: number;
    totalErrors: number;
    averageUptime: number;
  } {
    let totalFrames = 0;
    let totalErrors = 0;
    let totalUptime = 0;
    let activeCount = 0;

    for (const stats of this.streamStats.values()) {
      totalFrames += stats.totalFramesProcessed;
      totalErrors += stats.errorsCount;
      totalUptime += Date.now() - stats.uptime;
      activeCount += stats.activeStreams;
    }

    return {
      activeStreams: activeCount,
      totalFramesProcessed: totalFrames,
      totalErrors: totalErrors,
      averageUptime: activeCount > 0 ? totalUptime / activeCount : 0
    };
  }
}

export default EnhancedStreamManager;