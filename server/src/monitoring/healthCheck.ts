import { EventEmitter } from 'events';
import fs from 'fs/promises';
import MetricsCollector from './metricsCollector.js';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  lastCheck: Date;
  details?: any;
  error?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: {
    database: HealthCheckResult;
    memory: HealthCheckResult;
    disk: HealthCheckResult;
    connections: HealthCheckResult;
    streams: HealthCheckResult;
    events: HealthCheckResult;
  };
  uptime: number;
  timestamp: Date;
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

export interface HealthCheckOptions {
  timeout?: number;
  retries?: number;
  threshold?: {
    memoryUsage?: number; // percentage
    diskUsage?: number; // percentage
    cpuUsage?: number; // percentage
    activeConnections?: number;
    errorRate?: number; // percentage
  };
}

export class HealthCheckManager extends EventEmitter {
  private static instance: HealthCheckManager;
  private checks = new Map<string, () => Promise<HealthCheckResult>>();
  private checkIntervals = new Map<string, NodeJS.Timeout>();
  private defaultOptions: HealthCheckOptions = {
    timeout: 10000, // 10 seconds
    retries: 3,
    threshold: {
      memoryUsage: 85, // 85%
      diskUsage: 90, // 90%
      cpuUsage: 80, // 80%
      activeConnections: 1000,
      errorRate: 5 // 5%
    }
  };

  private constructor() {
    super();
    this.setupHealthChecks();
    this.startPeriodicChecks();
  }

  static getInstance(): HealthCheckManager {
    if (!HealthCheckManager.instance) {
      HealthCheckManager.instance = new HealthCheckManager();
    }
    return HealthCheckManager.instance;
  }

  private setupHealthChecks(): void {
    this.checks.set('database', this.checkDatabase.bind(this));
    this.checks.set('memory', this.checkMemory.bind(this));
    this.checks.set('disk', this.checkDisk.bind(this));
    this.checks.set('connections', this.checkConnections.bind(this));
    this.checks.set('streams', this.checkStreams.bind(this));
    this.checks.set('events', this.checkEvents.bind(this));
  }

  private startPeriodicChecks(): void {
    // Run basic health checks every minute
    setInterval(async () => {
      await this.runQuickHealthCheck();
    }, 60000);

    // Run comprehensive health checks every 5 minutes
    setInterval(async () => {
      await this.getSystemHealth();
    }, 300000);

    // Set up individual check intervals
    this.checkIntervals.set('memory', setInterval(async () => {
      await this.checkMemory();
    }, 30000)); // Check memory every 30 seconds
  }

  async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // This would need to be implemented with actual database
      // For now, simulate a database check
      await this.simulateAsyncOperation(50);
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: {
          connections: 'active',
          queryTime: 'normal',
          lastQuery: new Date()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: (error as Error).message,
        details: {
          connections: 'failed',
          error: (error as Error).message
        }
      };
    }
  }

  async checkMemory(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = require('os').totalmem();
      const memoryUsagePercent = (memUsage.rss / totalMemory) * 100;
      
      const threshold = this.defaultOptions.threshold?.memoryUsage || 85;
      let status: 'healthy' | 'unhealthy' | 'degraded';
      
      if (memoryUsagePercent > 95) {
        status = 'unhealthy';
      } else if (memoryUsagePercent > threshold) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }
      
      return {
        status,
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: {
          memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
          rss: memUsage.rss,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          threshold: `${threshold}%`
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: (error as Error).message
      };
    }
  }

  async checkDisk(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const stats = await fs.statfs(process.cwd());
      const total = stats.blocks * stats.blksize;
      const free = stats.bavail * stats.blksize;
      const used = total - free;
      const usagePercent = (used / total) * 100;
      
      const threshold = this.defaultOptions.threshold?.diskUsage || 90;
      let status: 'healthy' | 'unhealthy' | 'degraded';
      
      if (usagePercent > 95) {
        status = 'unhealthy';
      } else if (usagePercent > threshold) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }
      
      return {
        status,
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: {
          usagePercent: Math.round(usagePercent * 100) / 100,
          free: this.formatBytes(free),
          used: this.formatBytes(used),
          total: this.formatBytes(total),
          threshold: `${threshold}%`
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: (error as Error).message
      };
    }
  }

  async checkConnections(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const metricsCollector = MetricsCollector.getInstance();
      const performanceSummary = metricsCollector.getPerformanceSummary();
      
      const activeConnections = performanceSummary.requestsPerSecond;
      const threshold = this.defaultOptions.threshold?.activeConnections || 1000;
      
      let status: 'healthy' | 'unhealthy' | 'degraded';
      if (activeConnections > threshold * 2) {
        status = 'unhealthy';
      } else if (activeConnections > threshold) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }
      
      return {
        status,
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: {
          activeConnections,
          requestsPerSecond: performanceSummary.requestsPerSecond,
          avgResponseTime: performanceSummary.avgResponseTime,
          threshold: threshold
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: (error as Error).message
      };
    }
  }

  async checkStreams(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // This would need to be implemented with actual stream manager
      // For now, simulate stream health check
      await this.simulateAsyncOperation(30);
      
      const streamStats = {
        total: 10,
        active: 8,
        offline: 2,
        errors: 1
      };
      
      let status: 'healthy' | 'unhealthy' | 'degraded';
      const offlineRate = (streamStats.offline / streamStats.total) * 100;
      
      if (offlineRate > 50) {
        status = 'unhealthy';
      } else if (offlineRate > 20) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }
      
      return {
        status,
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: {
          ...streamStats,
          offlineRate: Math.round(offlineRate * 100) / 100,
          activeStreams: streamStats.active,
          lastActivity: new Date()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: (error as Error).message
      };
    }
  }

  async checkEvents(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // This would need to be implemented with actual event bus
      // For now, simulate event system check
      await this.simulateAsyncOperation(20);
      
      const eventStats = {
        queueSize: 15,
        processingRate: 100,
        errorRate: 2,
        lastProcessed: new Date()
      };
      
      let status: 'healthy' | 'unhealthy' | 'degraded';
      const errorThreshold = this.defaultOptions.threshold?.errorRate || 5;
      
      if (eventStats.queueSize > 1000) {
        status = 'unhealthy';
      } else if (eventStats.errorRate > errorThreshold) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }
      
      return {
        status,
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: {
          ...eventStats,
          errorThreshold: `${errorThreshold}%`,
          queueHealthy: eventStats.queueSize < 500
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: (error as Error).message
      };
    }
  }

  async runHealthCheck(checkName: string, options?: HealthCheckOptions): Promise<HealthCheckResult> {
    const checkFn = this.checks.get(checkName);
    if (!checkFn) {
      throw new Error(`Unknown health check: ${checkName}`);
    }
    
    const opts = { ...this.defaultOptions, ...options };
    const timeout = opts.timeout || 10000;
    
    try {
      const result = await Promise.race([
        checkFn(),
        new Promise<HealthCheckResult>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), timeout)
        )
      ]);
      
      return result;
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: timeout,
        lastCheck: new Date(),
        error: (error as Error).message
      };
    }
  }

  async runQuickHealthCheck(): Promise<SystemHealth> {
    const checkNames = ['memory', 'connections'];
    const checkResults: any = {};
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    for (const name of checkNames) {
      try {
        const result = await this.runHealthCheck(name);
        checkResults[name] = result;
        
        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        checkResults[name] = {
          status: 'unhealthy',
          responseTime: 0,
          lastCheck: new Date(),
          error: (error as Error).message
        };
        overallStatus = 'unhealthy';
      }
    }
    
    return this.buildHealthResponse(overallStatus, checkResults);
  }

  async getSystemHealth(options?: HealthCheckOptions): Promise<SystemHealth> {
    const checkResults: any = {};
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    for (const [name] of this.checks) {
      try {
        const result = await this.runHealthCheck(name, options);
        checkResults[name] = result;
        
        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        checkResults[name] = {
          status: 'unhealthy',
          responseTime: 0,
          lastCheck: new Date(),
          error: (error as Error).message
        };
        overallStatus = 'unhealthy';
      }
    }
    
    return this.buildHealthResponse(overallStatus, checkResults);
  }

  private buildHealthResponse(overallStatus: 'healthy' | 'unhealthy' | 'degraded', checkResults: any): SystemHealth {
    const checks = {
      database: checkResults.database || { status: 'unhealthy' as const, responseTime: 0, lastCheck: new Date() },
      memory: checkResults.memory || { status: 'unhealthy' as const, responseTime: 0, lastCheck: new Date() },
      disk: checkResults.disk || { status: 'unhealthy' as const, responseTime: 0, lastCheck: new Date() },
      connections: checkResults.connections || { status: 'unhealthy' as const, responseTime: 0, lastCheck: new Date() },
      streams: checkResults.streams || { status: 'unhealthy' as const, responseTime: 0, lastCheck: new Date() },
      events: checkResults.events || { status: 'unhealthy' as const, responseTime: 0, lastCheck: new Date() }
    };
    
    // Calculate summary
    const allChecks = Object.values(checks);
    const totalChecks = allChecks.length;
    const passed = allChecks.filter(c => c.status === 'healthy').length;
    const failed = allChecks.filter(c => c.status === 'unhealthy').length;
    const warnings = allChecks.filter(c => c.status === 'degraded').length;
    
    return {
      status: overallStatus,
      checks,
      uptime: process.uptime(),
      timestamp: new Date(),
      summary: {
        totalChecks,
        passed,
        failed,
        warnings
      }
    };
  }

  private async simulateAsyncOperation(delay: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Custom health check registration
  registerCustomCheck(name: string, checkFn: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, checkFn);
  }

  // Remove custom health check
  removeCustomCheck(name: string): void {
    if (name !== 'database' && name !== 'memory' && name !== 'disk') {
      this.checks.delete(name);
    }
  }

  // Get all registered checks
  getRegisteredChecks(): string[] {
    return Array.from(this.checks.keys());
  }
}

export default HealthCheckManager;