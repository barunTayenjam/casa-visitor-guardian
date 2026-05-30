import { Server as SocketIOServer } from "socket.io";
import { logger } from "../utils/logger.js";

interface HealthCheckConfig {
  intervalMs: number; // How often to check health (default: 30 seconds)
  staleThresholdMs: number; // Consider stream stale if no frames for X ms (default: 2 minutes)
  maxRestarts: number; // Max restart attempts within time window (default: 3 per hour)
}

interface CameraHealthStatus {
  cameraId: string;
  role: 'live' | 'detect' | 'record';
  lastFrameTime: number;
  restartAttempts: number;
  lastRestartTime: number;
  isActive: boolean;
}

export class StreamHealthMonitor {
  private io: SocketIOServer;
  private streamManager: any;
  private healthStatus: Map<string, CameraHealthStatus>;
  private checkInterval: NodeJS.Timeout | null;
  private config: HealthCheckConfig;

  constructor(io: SocketIOServer, config?: Partial<HealthCheckConfig>) {
    this.io = io;
    this.healthStatus = new Map();
    this.checkInterval = null;
    
    this.config = {
      intervalMs: config?.intervalMs || 30000, // 30 seconds
      staleThresholdMs: config?.staleThresholdMs || 300000, // 5 minutes (increased from 2 min)
      maxRestarts: config?.maxRestarts || 3
    };
  }

  setStreamManager(streamManager: any): void {
    this.streamManager = streamManager;
  }

  start(): void {
    if (this.checkInterval) {
      logger.warn('Health monitor already running', 'HealthMonitor');
      return;
    }

    logger.info('Starting stream health monitor', 'HealthMonitor', {
      intervalMs: this.config.intervalMs,
      staleThresholdMs: this.config.staleThresholdMs,
      maxRestarts: this.config.maxRestarts
    });

    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.intervalMs);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Stopped stream health monitor', 'HealthMonitor');
    }
  }

  // Call this when a frame is emitted for a camera
  recordFrameEmitted(cameraId: string, role: 'live' | 'detect' | 'record'): void {
    const key = `${cameraId}-${role}`;
    const now = Date.now();
    
    const status = this.healthStatus.get(key) || {
      cameraId,
      role,
      lastFrameTime: 0,
      restartAttempts: 0,
      lastRestartTime: 0,
      isActive: false
    };

    status.lastFrameTime = now;
    status.isActive = true;
    this.healthStatus.set(key, status);
  }

  // Call this when a stream is stopped
  recordStreamStopped(cameraId: string, role: 'live' | 'detect' | 'record'): void {
    const key = `${cameraId}-${role}`;
    const status = this.healthStatus.get(key);
    if (status) {
      status.isActive = false;
      this.healthStatus.set(key, status);
    }
  }

  private performHealthCheck(): void {
    if (!this.streamManager) {
      return;
    }

    const now = Date.now();
    const cameras = this.streamManager.getAllCameras();

    logger.debug(`Running health check for ${cameras.length} cameras`, 'HealthMonitor');

    cameras.forEach((camera: any) => {
      ['live', 'detect', 'record'].forEach((role) => {
        const key = `${camera.id}-${role}`;
        const status = this.healthStatus.get(key);

        if (!status || status.lastFrameTime === 0) {
          return;
        }

        const wasActive = status.isActive;
        const timeSinceLastFrame = now - status.lastFrameTime;

        if (timeSinceLastFrame > this.config.staleThresholdMs) {
          this.handleStaleStream(camera.id, role as 'live' | 'detect' | 'record', timeSinceLastFrame, status);
        } else if (camera.activeRoles && !camera.activeRoles.has(role) && wasActive && (role === 'detect' || role === 'record')) {
          logger.info(`[HealthMonitor] ${camera.id} ${role} lost active role but was running — restarting`, 'STREAM');
          this.handleStaleStream(camera.id, role as 'live' | 'detect' | 'record', timeSinceLastFrame, status);
        }
      });
    });
  }

  private handleStaleStream(
    cameraId: string,
    role: 'live' | 'detect' | 'record',
    staleTime: number,
    status: CameraHealthStatus
  ): void {
    const staleMinutes = Math.floor(staleTime / 60000);
    
    // Check if we've restarted too many times recently
    const timeSinceLastRestart = Date.now() - status.lastRestartTime;
    const oneHour = 3600000; // 1 hour in ms
    
    if (timeSinceLastRestart > oneHour) {
      // Reset counter if it's been more than an hour
      status.restartAttempts = 0;
    }

    if (status.restartAttempts >= this.config.maxRestarts) {
      logger.error(
        `Camera ${cameraId} ${role} stream is stale (${staleMinutes} min) but max restarts reached`,
        'HealthMonitor',
        { cameraId, role, staleMinutes, restartAttempts: status.restartAttempts }
      );
      
      // Emit alert to clients
      this.io.emit('streamHealthAlert', {
        cameraId,
        role,
        severity: 'critical',
        message: `Stream unavailable for ${staleMinutes} minutes. Max restart attempts reached.`,
        timestamp: new Date().toISOString()
      });
      
      return;
    }

    // Attempt restart
    logger.warn(
      `Camera ${cameraId} ${role} stream is stale (${staleMinutes} min), restarting...`,
      'HealthMonitor',
      { cameraId, role, staleMinutes, restartAttempt: status.restartAttempts + 1 }
    );

    // Emit alert to clients
    this.io.emit('streamHealthAlert', {
      cameraId,
      role,
      severity: 'warning',
      message: `Stream was stale for ${staleMinutes} minutes. Restarting...`,
      timestamp: new Date().toISOString()
    });

    // Restart the stream
    try {
      const success = this.streamManager.restartStream(cameraId, role);
      
      if (success) {
        status.restartAttempts++;
        status.lastRestartTime = Date.now();
        this.healthStatus.set(`${cameraId}-${role}`, status);
        
        logger.info(
          `Successfully restarted stale stream for ${cameraId} ${role}`,
          'HealthMonitor'
        );
        
        // Emit success notification
        this.io.emit('streamHealthAlert', {
          cameraId,
          role,
          severity: 'info',
          message: `Stream restarted successfully after being stale for ${staleMinutes} minutes`,
          timestamp: new Date().toISOString()
        });
      } else {
        logger.error(
          `Failed to restart stale stream for ${cameraId} ${role}`,
          'HealthMonitor'
        );
      }
    } catch (error) {
      logger.error(
        `Error restarting stale stream for ${cameraId} ${role}`,
        'HealthMonitor',
        error
      );
    }
  }

  getHealthStatus(): Array<{ key: string; status: CameraHealthStatus }> {
    return Array.from(this.healthStatus.entries()).map(([key, status]) => ({
      key,
      status
    }));
  }

  getCameraHealth(cameraId: string): Map<string, CameraHealthStatus> {
    const cameraHealth = new Map<string, CameraHealthStatus>();
    this.healthStatus.forEach((status, key) => {
      if (status.cameraId === cameraId) {
        cameraHealth.set(key, status);
      }
    });
    return cameraHealth;
  }

  resetRestartCounter(cameraId: string, role: 'live' | 'detect' | 'record'): void {
    const key = `${cameraId}-${role}`;
    const status = this.healthStatus.get(key);
    if (status) {
      status.restartAttempts = 0;
      status.lastRestartTime = 0;
      this.healthStatus.set(key, status);
      logger.info(`Reset restart counter for ${cameraId} ${role}`, 'HealthMonitor');
    }
  }
}
