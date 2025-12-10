import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { Response } from 'express';
import { EventBus } from '../events/eventBus.js';
import { BaseService } from '../services/baseService.js';
import { config, getCameraById } from '../config/index.js';
import ffmpegStatic from "ffmpeg-static";

const ffmpegPath = ffmpegStatic as unknown as string;

export interface GentleStreamConfig {
  cameraId: string;
  rtspUrl: string;
  username?: string;
  password?: string;
  frameRate: number;
  resolution: string;
  nightMode: boolean;
  quality: number;
  timeout?: number;
}

export interface CameraHealth {
  isHealthy: boolean;
  lastConnected?: Date;
  consecutiveFailures: number;
  backoffUntil?: Date;
  currentQuality: 'low' | 'medium' | 'high';
}

export class GentleStreamManager extends BaseService {
  private activeStreams = new Map<string, ChildProcess>();
  private cameraHealth = new Map<string, CameraHealth>();
  private connectionAttempts = new Map<string, number>();
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly BASE_RETRY_DELAY = 30000; // 30 seconds
  private readonly MAX_RETRY_DELAY = 300000; // 5 minutes
  private readonly CONNECTION_RATE_LIMIT = 60000; // 1 minute between attempts

  constructor() {
    super('GentleStreamManager');
    this.setupEventHandlers();
  }

  protected setupEventHandlers(): void {
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
    this.eventBus.on('camera', this.handleCameraEvent.bind(this));
  }

  private handleCameraEvent(event: any): void {
    if (event.data.status === 'offline') {
      this.cleanupStream(event.data.cameraId);
    }
  }

  // Pre-connection health check
  private async checkCameraHealth(cameraId: string): Promise<boolean> {
    const health = this.cameraHealth.get(cameraId) || {
      isHealthy: true,
      consecutiveFailures: 0,
      currentQuality: 'low'
    };

    // Check if we're in backoff period
    if (health.backoffUntil && health.backoffUntil > new Date()) {
      this.logInfo(`Camera ${cameraId} is in backoff period until ${health.backoffUntil}`);
      return false;
    }

    // Check rate limiting
    const lastAttempt = this.connectionAttempts.get(cameraId) || 0;
    const timeSinceLastAttempt = Date.now() - lastAttempt;
    if (timeSinceLastAttempt < this.CONNECTION_RATE_LIMIT) {
      this.logInfo(`Camera ${cameraId} rate limited, wait ${Math.ceil((this.CONNECTION_RATE_LIMIT - timeSinceLastAttempt) / 1000)}s`);
      return false;
    }

    return true;
  }

  // Calculate exponential backoff delay
  private calculateBackoffDelay(failures: number): number {
    const delay = this.BASE_RETRY_DELAY * Math.pow(2, failures);
    return Math.min(delay, this.MAX_RETRY_DELAY);
  }

  // Get conservative settings based on camera health
  private getConservativeConfig(config: GentleStreamConfig): GentleStreamConfig {
    const health = this.cameraHealth.get(config.cameraId);
    
    if (!health || health.consecutiveFailures > 0) {
      // Use very conservative settings for struggling cameras
      return {
        ...config,
        frameRate: 1, // 1 fps
        resolution: '640x480', // Very low resolution
        quality: 8, // Lower quality (higher number = lower quality)
        timeout: 10000 // 10 second timeout
      };
    }

    // Use low quality settings initially
    return {
      ...config,
      frameRate: 2, // 2 fps
      resolution: '640x480', // Low resolution
      quality: 6, // Moderate quality
      timeout: 15000 // 15 second timeout
    };
  }

  async createGentleStream(streamConfig: GentleStreamConfig, res?: Response): Promise<boolean> {
    const cameraId = streamConfig.cameraId;

    // Pre-connection checks
    if (!(await this.checkCameraHealth(cameraId))) {
      return false;
    }

    // Update connection attempt timestamp
    this.connectionAttempts.set(cameraId, Date.now());

    // Get conservative configuration
    const gentleConfig = this.getConservativeConfig(streamConfig);

    // Clean up existing stream
    this.cleanupStream(cameraId);

    try {
      this.logInfo(`Starting gentle stream for camera ${cameraId}`, {
        config: { ...gentleConfig, password: '***' }
      });

      const ffmpegArgs = this.buildGentleFFmpegArgs(gentleConfig);
      const ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          FFREPORT: `file=${cameraId}_gentle.log:level=32`
        }
      });

      this.activeStreams.set(cameraId, ffmpeg);
      this.setupGentleProcessHandlers(cameraId, ffmpeg, res, gentleConfig);

      return true;
    } catch (error) {
      this.handleConnectionFailure(cameraId, error as Error);
      return false;
    }
  }

  private buildGentleFFmpegArgs(config: GentleStreamConfig): string[] {
    const args = [
      // Very conservative input options
      '-loglevel', 'error',
      '-rtsp_transport', 'tcp',
      '-timeout', String(config.timeout || 15000),
      '-rtsp_flags', 'prefer_tcp',
      '-fflags', '+discardcorrupt+genpts',
      '-err_detect', 'ignore_err',
      '-thread_queue_size', '256', // Small queue
      '-re', // Read at native frame rate
      
      // Minimal analysis to reduce load
      '-probesize', '100000', // 100KB (very small)
      '-analyzeduration', '500000', // 0.5 seconds
      '-max_delay', '200000', // 200ms
      
      // Input source
      '-i', this.buildAuthenticatedUrl(config),
      
      // Conservative output options
      '-f', 'mjpeg',
      '-pix_fmt', 'yuvj420p',
      '-vcodec', 'mjpeg',
      '-q:v', String(config.quality || 6),
      '-r', String(config.frameRate),
      '-movflags', 'frag_keyframe+empty_moov',
      '-flush_packets', '1'
    ];

    // Simple scaling
    const [width, height] = config.resolution.split('x');
    args.push('-vf', `scale=${width}:${height}`);
    args.push('pipe:1');

    return args;
  }

  private buildAuthenticatedUrl(config: GentleStreamConfig): string {
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

  private setupGentleProcessHandlers(
    cameraId: string,
    ffmpeg: ChildProcess,
    res: Response | undefined,
    config: GentleStreamConfig
  ): void {
    let frameCount = 0;

    ffmpeg.stdout?.on('data', (chunk: Buffer) => {
      frameCount++;
      
      // Emit frame events at reduced rate
      if (frameCount % 10 === 0) { // Only emit every 10th frame
        this.eventBus.emit('frame', {
          cameraId,
          data: chunk.toString('base64'),
          timestamp: new Date(),
          frameNumber: frameCount
        });
      }

      if (res && !res.writableEnded) {
        res.write(chunk);
      }
    });

    ffmpeg.stderr?.on('data', (data: Buffer) => {
      // Log errors but don't spam
      const message = data.toString();
      if (message.includes('error') || message.includes('failed')) {
        this.logError(new Error(`Camera ${cameraId} stream error: ${message.substring(0, 200)}`));
      }
    });

    ffmpeg.on('close', (code: number | null) => {
      this.activeStreams.delete(cameraId);
      
      if (code !== 0) {
        this.handleConnectionFailure(cameraId, new Error(`FFmpeg exited with code ${code}`));
      } else {
        this.handleConnectionSuccess(cameraId);
      }
    });

    ffmpeg.on('error', (error: Error) => {
      this.handleConnectionFailure(cameraId, error);
    });
  }

  private handleConnectionSuccess(cameraId: string): void {
    const health = this.cameraHealth.get(cameraId) || {
      isHealthy: true,
      consecutiveFailures: 0,
      currentQuality: 'low'
    };

    health.isHealthy = true;
    health.consecutiveFailures = 0;
    health.lastConnected = new Date();
    health.backoffUntil = undefined;

    this.cameraHealth.set(cameraId, health);
    this.logInfo(`Camera ${cameraId} connected successfully`);
  }

  private handleConnectionFailure(cameraId: string, error: Error): void {
    const health = this.cameraHealth.get(cameraId) || {
      isHealthy: true,
      consecutiveFailures: 0,
      currentQuality: 'low'
    };

    health.consecutiveFailures++;
    health.isHealthy = false;

    // Calculate backoff
    const backoffDelay = this.calculateBackoffDelay(health.consecutiveFailures);
    health.backoffUntil = new Date(Date.now() + backoffDelay);

    this.cameraHealth.set(cameraId, health);

    this.logError(error, {
      consecutiveFailures: health.consecutiveFailures,
      backoffUntil: health.backoffUntil,
      nextRetryIn: `${Math.ceil(backoffDelay / 1000)}s`
    });

    // Schedule retry with exponential backoff
    setTimeout(() => {
      this.logInfo(`Attempting retry for camera ${cameraId}`);
      // Retry would be handled by calling createGentleStream again
    }, backoffDelay);
  }

  private cleanupStream(cameraId: string): void {
    const stream = this.activeStreams.get(cameraId);
    if (stream) {
      stream.kill('SIGTERM');
      this.activeStreams.delete(cameraId);
    }
  }

  async shutdown(): Promise<void> {
    this.logInfo('Shutting down gentle stream manager');
    
    for (const [cameraId, stream] of this.activeStreams) {
      stream.kill('SIGTERM');
    }
    
    this.activeStreams.clear();
  }

  // Staggered startup for multiple cameras
  async startAllCamerasGently(cameras: GentleStreamConfig[]): Promise<void> {
    this.logInfo(`Starting ${cameras.length} cameras with staggered delays`);
    
    for (let i = 0; i < cameras.length; i++) {
      const camera = cameras[i];
      this.logInfo(`Starting camera ${i + 1}/${cameras.length}: ${camera.cameraId}`);
      
      await this.createGentleStream(camera);
      
      // Wait 30 seconds between cameras to avoid overwhelming
      if (i < cameras.length - 1) {
        this.logInfo(`Waiting 30 seconds before starting next camera...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }

  getCameraHealth(cameraId: string): CameraHealth | undefined {
    return this.cameraHealth.get(cameraId);
  }
}