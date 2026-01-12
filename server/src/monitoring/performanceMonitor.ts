import { performance } from 'perf_hooks';
import { createClient } from 'redis';
import { EventEmitter } from 'events';
import { consolidatedDetectionService } from '../detection/consolidatedDetectionService.js';
import { logger } from '../utils/logger.js';

interface PerformanceMetrics {
  timestamp: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  processingTime: {
    objectDetection: number;
    facialRecognition: number;
    motionDetection: number;
  };
  detectionCounts: {
    objects: number;
    faces: number;
    motions: number;
  };
  errorRate: number;
  cacheHitRate: number;
  streamLatency: number;
}

interface AlertThreshold {
  type: 'memory' | 'cpu' | 'processing' | 'error';
  threshold: number;
  duration: number; // seconds
}

interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metrics: Partial<PerformanceMetrics>;
}

class PerformanceMonitor extends EventEmitter {
  private redisClient: any;
  private metrics: PerformanceMetrics;
  private detectionService: any;
  private alertThresholds: AlertThreshold[];
  private alerts: Alert[];
  private monitoringInterval: NodeJS.Timeout | null;
  private alertHistory: Map<string, number[]>;

  constructor() {
    super();
    this.detectionService = consolidatedDetectionService;
    this.metrics = this.initializeMetrics();
    this.alerts = [];
    this.alertHistory = new Map();
    this.alertThresholds = this.getDefaultThresholds();
    
    this.initializeRedis();
    this.startMonitoring();
  }

  private initializeMetrics(): PerformanceMetrics {
    const memoryUsage = process.memoryUsage();
    return {
      timestamp: Date.now(),
      memoryUsage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      },
      cpuUsage: {
        user: 0,
        system: 0
      },
      processingTime: {
        objectDetection: 0,
        facialRecognition: 0,
        motionDetection: 0
      },
      detectionCounts: {
        objects: 0,
        faces: 0,
        motions: 0
      },
      errorRate: 0,
      cacheHitRate: 0,
      streamLatency: 0
    };
  }

  private async initializeRedis() {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      await this.redisClient.connect();
      logger.info('Redis connected for performance monitoring');
    } catch (error) {
      logger.error('Failed to connect to Redis for monitoring:', error);
    }
  }

  private getDefaultThresholds(): AlertThreshold[] {
    return [
      { type: 'memory', threshold: 0.8, duration: 60 }, // 80% memory usage for 60 seconds
      { type: 'cpu', threshold: 0.7, duration: 300 }, // 70% CPU for 5 minutes
      { type: 'processing', threshold: 1000, duration: 60 }, // 1000ms processing time for 60 seconds
      { type: 'error', threshold: 0.1, duration: 300 } // 10% error rate for 5 minutes
    ];
  }

  private startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
      this.storeMetrics();
    }, 5000); // Collect metrics every 5 seconds

    // Also monitor detection service performance
    this.detectionService.on('performance', (metrics) => {
      this.updateDetectionMetrics(metrics);
    });

    this.detectionService.on('error', (error) => {
      this.incrementErrorCount();
    });
  }

  private collectMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = this.getCPUUsage();
    
    this.metrics = {
      ...this.metrics,
      timestamp: Date.now(),
      memoryUsage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };
  }

  private getCPUUsage(): { user: number; system: number } {
    const usage = process.cpuUsage();
    return {
      user: usage.user / 1000000, // Convert to seconds
      system: usage.system / 1000000
    };
  }

  private updateDetectionMetrics(detectionMetrics: any) {
    this.metrics.processingTime = {
      ...this.metrics.processingTime,
      objectDetection: detectionMetrics.objectDetectionTime || this.metrics.processingTime.objectDetection,
      facialRecognition: detectionMetrics.facialRecognitionTime || this.metrics.processingTime.facialRecognition,
      motionDetection: detectionMetrics.motionDetectionTime || this.metrics.processingTime.motionDetection
    };

    this.metrics.detectionCounts = {
      ...this.metrics.detectionCounts,
      objects: detectionMetrics.objectCount || this.metrics.detectionCounts.objects,
      faces: detectionMetrics.faceCount || this.metrics.detectionCounts.faces,
      motions: detectionMetrics.motionCount || this.metrics.detectionCounts.motions
    };

    this.metrics.cacheHitRate = detectionMetrics.cacheHitRate || this.metrics.cacheHitRate;
    this.metrics.streamLatency = detectionMetrics.streamLatency || this.metrics.streamLatency;
  }

  private incrementErrorCount() {
    this.metrics.errorRate = Math.min(this.metrics.errorRate + 0.01, 1);
  }

  private checkAlerts() {
    this.alertThresholds.forEach((threshold) => {
      let alertTriggered = false;
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

      switch (threshold.type) {
        case 'memory':
          const memoryRatio = this.metrics.memoryUsage.heapUsed / this.metrics.memoryUsage.heapTotal;
          if (memoryRatio > threshold.threshold) {
            alertTriggered = true;
            severity = memoryRatio > 0.9 ? 'critical' : memoryRatio > 0.85 ? 'high' : 'medium';
          }
          break;
        case 'cpu':
          const cpuRatio = (this.metrics.cpuUsage.user + this.metrics.cpuUsage.system) / 2;
          if (cpuRatio > threshold.threshold) {
            alertTriggered = true;
            severity = cpuRatio > 0.9 ? 'critical' : cpuRatio > 0.8 ? 'high' : 'medium';
          }
          break;
        case 'processing':
          const avgProcessingTime = (
            this.metrics.processingTime.objectDetection +
            this.metrics.processingTime.facialRecognition +
            this.metrics.processingTime.motionDetection
          ) / 3;
          if (avgProcessingTime > threshold.threshold) {
            alertTriggered = true;
            severity = avgProcessingTime > 2000 ? 'critical' : avgProcessingTime > 1500 ? 'high' : 'medium';
          }
          break;
        case 'error':
          if (this.metrics.errorRate > threshold.threshold) {
            alertTriggered = true;
            severity = this.metrics.errorRate > 0.2 ? 'critical' : this.metrics.errorRate > 0.15 ? 'high' : 'medium';
          }
          break;
      }

      if (alertTriggered) {
        this.triggerAlert(threshold, severity);
      }
    });
  }

  private triggerAlert(threshold: AlertThreshold, severity: 'low' | 'medium' | 'high' | 'critical') {
    const alertId = `${threshold.type}-${Date.now()}`;
    const alert: Alert = {
      id: alertId,
      type: threshold.type,
      severity,
      message: this.generateAlertMessage(threshold, severity),
      timestamp: Date.now(),
      metrics: { ...this.metrics }
    };

    this.alerts.push(alert);
    this.alertHistory.set(alertId, [Date.now()]);
    
    this.emit('alert', alert);
    logger.warn(`Performance alert triggered: ${alert.message}`, { severity: severity, metrics: this.metrics });
  }

  private generateAlertMessage(threshold: AlertThreshold, severity: string): string {
    const messages: Record<string, Record<string, string>> = {
      memory: {
        low: 'Memory usage approaching threshold',
        medium: 'Memory usage at threshold',
        high: 'High memory usage detected',
        critical: 'CRITICAL: Memory usage exceeding threshold'
      },
      cpu: {
        low: 'CPU usage approaching threshold',
        medium: 'CPU usage at threshold',
        high: 'High CPU usage detected',
        critical: 'CRITICAL: CPU usage exceeding threshold'
      },
      processing: {
        low: 'Processing time approaching threshold',
        medium: 'Processing time at threshold',
        high: 'High processing time detected',
        critical: 'CRITICAL: Processing time exceeding threshold'
      },
      error: {
        low: 'Error rate approaching threshold',
        medium: 'Error rate at threshold',
        high: 'High error rate detected',
        critical: 'CRITICAL: Error rate exceeding threshold'
      }
    };

    return messages[threshold.type][severity as keyof typeof messages.memory];
  }

  private async storeMetrics() {
    try {
      const metricsKey = `performance:metrics:${this.metrics.timestamp}`;
      await this.redisClient.set(metricsKey, JSON.stringify(this.metrics), {
        EX: 86400 // Store for 24 hours
      });

      // Keep only last 1000 metrics in memory
      if (this.alerts.length > 1000) {
        this.alerts = this.alerts.slice(-1000);
      }
    } catch (error) {
      logger.error('Failed to store metrics:', error);
    }
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getAlerts(): Alert[] {
    return [...this.alerts];
  }

  public async getHistoricalMetrics(hours: number = 24): Promise<PerformanceMetrics[]> {
    try {
      const endTime = Date.now();
      const startTime = endTime - (hours * 60 * 60 * 1000);
      const keys = await this.redisClient.keys('performance:metrics:*');
      
      const metricsPromises = keys
        .map(key => parseInt(key.split(':')[2]))
        .filter(timestamp => timestamp >= startTime && timestamp <= endTime)
        .sort((a, b) => a - b)
        .map(timestamp => 
          this.redisClient.get(`performance:metrics:${timestamp}`)
            .then(data => data ? JSON.parse(data) : null)
        );

      const metrics = await Promise.all(metricsPromises);
      return metrics.filter(Boolean) as PerformanceMetrics[];
    } catch (error) {
      logger.error('Failed to get historical metrics:', error);
      return [];
    }
  }

  public async getAlertHistory(hours: number = 24): Promise<Alert[]> {
    try {
      const endTime = Date.now();
      const startTime = endTime - (hours * 60 * 60 * 1000);
      
      const alerts = this.alerts.filter(alert => 
        alert.timestamp >= startTime && alert.timestamp <= endTime
      );

      return alerts;
    } catch (error) {
      logger.error('Failed to get alert history:', error);
      return [];
    }
  }

  public setThresholds(thresholds: AlertThreshold[]) {
    this.alertThresholds = thresholds;
  }

  public stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.emit('stopped');
  }

  public onAlert(callback: (alert: Alert) => void) {
    this.on('alert', callback);
  }

  public onStopped(callback: () => void) {
    this.on('stopped', callback);
  }
}

export { PerformanceMonitor, PerformanceMetrics, AlertThreshold, Alert };