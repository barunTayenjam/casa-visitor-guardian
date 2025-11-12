import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  activeConnections: number;
  errorRate: number;
}

export interface SystemMetrics {
  timestamp: number;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
  activeStreams: number;
  queuedEvents: number;
  databaseConnections: number;
  diskUsage?: {
    total: number;
    free: number;
    used: number;
  };
  networkActivity?: {
    bytesIn: number;
    bytesOut: number;
    connections: number;
  };
}

export interface RequestMetrics {
  method: string;
  route: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  userAgent?: string;
  ip?: string;
  size?: number;
}

export class MetricsCollector extends EventEmitter {
  private static instance: MetricsCollector;
  private metrics: Map<string, any> = new Map();
  private startTime: number;
  private requestMetrics: RequestMetrics[] = [];
  private maxRequestMetrics = 10000; // Keep last 10k requests
  
  // Prometheus-style counters
  private httpRequestsTotal = new Map<string, number>();
  private httpRequestDuration = new Map<string, number[]>();
  private activeConnections = 0;
  private errorsTotal = new Map<string, number>();
  
  // Custom counters
  private framesProcessed = 0;
  private eventsProcessed = 0;
  private streamsStarted = 0;
  private streamsStopped = 0;
  
  private readonly COLLECTION_INTERVAL = 30000; // 30 seconds
  private readonly MEMORY_INTERVAL = 10000; // 10 seconds

  private constructor() {
    super();
    this.startTime = Date.now();
    this.startCollection();
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  private startCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, this.COLLECTION_INTERVAL);

    // Collect memory metrics every 10 seconds
    setInterval(() => {
      this.collectMemoryMetrics();
    }, this.MEMORY_INTERVAL);
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    responseTime: number,
    userAgent?: string,
    ip?: string,
    size?: number
  ): void {
    const statusClass = Math.floor(statusCode / 10).toString();
    const key = `${method}:${route}`;
    
    // Update total counter
    const currentTotal = this.httpRequestsTotal.get(`${method}:${route}:${statusClass}`) || 0;
    this.httpRequestsTotal.set(`${method}:${route}:${statusClass}`, currentTotal + 1);
    
    // Update duration histogram
    if (!this.httpRequestDuration.has(key)) {
      this.httpRequestDuration.set(key, []);
    }
    const durations = this.httpRequestDuration.get(key)!;
    durations.push(responseTime);
    
    // Keep only last 1000 duration measurements per route
    if (durations.length > 1000) {
      durations.splice(0, durations.length - 1000);
    }
    
    // Store individual request
    const requestMetric: RequestMetrics = {
      method,
      route,
      statusCode,
      responseTime,
      timestamp: Date.now(),
      userAgent,
      ip,
      size
    };
    
    this.requestMetrics.push(requestMetric);
    
    // Keep only recent requests
    if (this.requestMetrics.length > this.maxRequestMetrics) {
      this.requestMetrics.splice(0, this.requestMetrics.length - this.maxRequestMetrics);
    }
    
    // Emit event for real-time monitoring
    this.emit('httpRequest', requestMetric);
  }

  recordError(type: string, component: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    const key = `${type}:${component}`;
    const current = this.errorsTotal.get(key) || 0;
    this.errorsTotal.set(key, current + 1);
    
    // Emit error event
    this.emit('error', {
      type,
      component,
      severity,
      timestamp: Date.now(),
      total: this.errorsTotal.get(key)
    });
  }

  recordConnection(): void {
    this.activeConnections++;
    this.emit('connection', { active: this.activeConnections, timestamp: Date.now() });
  }

  recordDisconnection(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
    this.emit('disconnection', { active: this.activeConnections, timestamp: Date.now() });
  }

  recordFrameProcessed(): void {
    this.framesProcessed++;
  }

  recordEventProcessed(): void {
    this.eventsProcessed++;
  }

  recordStreamStarted(): void {
    this.streamsStarted++;
  }

  recordStreamStopped(): void {
    this.streamsStopped++;
  }

  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const metrics: SystemMetrics = {
      timestamp: Date.now(),
      uptime: process.uptime(),
      memory: memUsage,
      cpu: cpuUsage,
      activeStreams: this.getActiveStreamCount(),
      queuedEvents: this.getQueuedEventCount(),
      databaseConnections: this.getDatabaseConnectionCount()
    };
    
    this.metrics.set('system', metrics);
    this.emit('systemMetrics', metrics);
  }

  private collectMemoryMetrics(): void {
    const memUsage = process.memoryUsage();
    
    this.metrics.set('memory', {
      ...memUsage,
      timestamp: Date.now(),
      heapUsedPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      rssPercent: (memUsage.rss / memUsage.heapTotal) * 100
    });
    
    // Emit memory usage warning if high
    if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
      this.emit('memoryWarning', {
        usage: memUsage,
        percent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        timestamp: Date.now()
      });
    }
  }

  getMetrics(): Map<string, any> {
    return new Map(this.metrics);
  }

  getPrometheusMetrics(): string {
    const lines: string[] = [];
    
    // HTTP request total counter
    for (const [key, value] of this.httpRequestsTotal) {
      const [method, route, statusClass] = key.split(':');
      lines.push(`http_requests_total{method="${method}",route="${route}",status_class="${statusClass}"} ${value}`);
    }
    
    // HTTP request duration histogram
    for (const [route, durations] of this.httpRequestDuration) {
      if (durations.length > 0) {
        const sorted = [...durations].sort((a, b) => a - b);
        const count = sorted.length;
        const sum = sorted.reduce((a, b) => a + b, 0);
        const mean = sum / count;
        const p50 = sorted[Math.floor(count * 0.5)];
        const p95 = sorted[Math.floor(count * 0.95)];
        const p99 = sorted[Math.floor(count * 0.99)];
        
        lines.push(`http_request_duration_seconds{route="${route}",quantile="0.5"} ${p50 / 1000}`);
        lines.push(`http_request_duration_seconds{route="${route}",quantile="0.95"} ${p95 / 1000}`);
        lines.push(`http_request_duration_seconds{route="${route}",quantile="0.99"} ${p99 / 1000}`);
        lines.push(`http_request_duration_seconds_sum{route="${route}"} ${sum / 1000}`);
        lines.push(`http_request_duration_seconds_count{route="${route}"} ${count}`);
      }
    }
    
    // Active connections gauge
    lines.push(`active_connections ${this.activeConnections}`);
    
    // Error counters
    for (const [key, value] of this.errorsTotal) {
      const [type, component] = key.split(':');
      lines.push(`errors_total{type="${type}",component="${component}"} ${value}`);
    }
    
    // Custom metrics
    lines.push(`frames_processed_total ${this.framesProcessed}`);
    lines.push(`events_processed_total ${this.eventsProcessed}`);
    lines.push(`streams_started_total ${this.streamsStarted}`);
    lines.push(`streams_stopped_total ${this.streamsStopped}`);
    
    // System metrics
    const systemMetrics = this.metrics.get('system') as SystemMetrics;
    if (systemMetrics) {
      lines.push(`process_uptime_seconds ${systemMetrics.uptime}`);
      lines.push(`active_streams ${systemMetrics.activeStreams}`);
      lines.push(`queued_events ${systemMetrics.queuedEvents}`);
      lines.push(`database_connections ${systemMetrics.databaseConnections}`);
    }
    
    // Memory metrics
    const memMetrics = this.metrics.get('memory');
    if (memMetrics) {
      lines.push(`process_memory_bytes{type="rss"} ${memMetrics.rss}`);
      lines.push(`process_memory_bytes{type="heap_used"} ${memMetrics.heapUsed}`);
      lines.push(`process_memory_bytes{type="heap_total"} ${memMetrics.heapTotal}`);
      lines.push(`process_memory_bytes{type="external"} ${memMetrics.external}`);
    }
    
    return lines.join('\n') + '\n';
  }

  getRequestMetrics(options: {
    startTime?: number;
    endTime?: number;
    method?: string;
    route?: string;
    statusCode?: number;
    limit?: number;
  } = {}): RequestMetrics[] {
    let filtered = [...this.requestMetrics];
    
    // Filter by time range
    if (options.startTime !== undefined) {
      filtered = filtered.filter(m => m.timestamp >= options.startTime!);
    }
    
    if (options.endTime !== undefined) {
      filtered = filtered.filter(m => m.timestamp <= options.endTime!);
    }
    
    // Filter by method
    if (options.method) {
      filtered = filtered.filter(m => m.method === options.method);
    }
    
    // Filter by route
    if (options.route) {
      filtered = filtered.filter(m => m.route === options.route);
    }
    
    // Filter by status code
    if (options.statusCode) {
      filtered = filtered.filter(m => m.statusCode === options.statusCode);
    }
    
    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    
    return filtered;
  }

  getErrorMetrics(): Array<{
    type: string;
    component: string;
    count: number;
  }> {
    const errors: Array<{ type: string; component: string; count: number }> = [];
    
    for (const [key, count] of this.errorsTotal) {
      const [type, component] = key.split(':');
      errors.push({ type, component, count });
    }
    
    return errors;
  }

  getPerformanceSummary(): {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    requestsPerSecond: number;
    uptime: number;
  } {
    const recentRequests = this.getRequestMetrics({
      startTime: Date.now() - 60000, // Last minute
      endTime: Date.now()
    });
    
    if (recentRequests.length === 0) {
      return {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        requestsPerSecond: 0,
        uptime: process.uptime()
      };
    }
    
    const responseTimes = recentRequests.map(r => r.responseTime).sort((a, b) => a - b);
    const errorCount = recentRequests.filter(r => r.statusCode >= 400).length;
    const count = responseTimes.length;
    const sum = responseTimes.reduce((a, b) => a + b, 0);
    
    return {
      avgResponseTime: sum / count,
      p95ResponseTime: responseTimes[Math.floor(count * 0.95)],
      p99ResponseTime: responseTimes[Math.floor(count * 0.99)],
      errorRate: (errorCount / count) * 100,
      requestsPerSecond: recentRequests.length / 60,
      uptime: process.uptime()
    };
  }

  private getActiveStreamCount(): number {
    // This would need to be implemented with actual stream manager
    return 0; // Placeholder
  }

  private getQueuedEventCount(): number {
    // This would need to be implemented with actual event bus
    return 0; // Placeholder
  }

  private getDatabaseConnectionCount(): number {
    // This would need to be implemented with actual connection pool
    return 0; // Placeholder
  }

  reset(): void {
    this.httpRequestsTotal.clear();
    this.httpRequestDuration.clear();
    this.errorsTotal.clear();
    this.requestMetrics = [];
    this.framesProcessed = 0;
    this.eventsProcessed = 0;
    this.streamsStarted = 0;
    this.streamsStopped = 0;
    
    this.emit('reset', { timestamp: Date.now() });
  }
}

export default MetricsCollector;