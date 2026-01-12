import { performanceMonitor } from './performanceMonitor.js';

/**
 * Metrics collector interface
 */
export interface MetricsData {
  timestamp: number;
  type: 'memory' | 'cpu' | 'detection' | 'error';
  value: any;
  metadata?: Record<string, any>;
}

/**
 * Metrics collector service for aggregating and storing performance data
 */
export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: MetricsData[] = [];
  private maxMetricsSize = 5000; // Keep last 5000 metrics entries
  private collectionInterval: NodeJS.Timeout | null = null;
  private isCollecting = false;

  private constructor() {
    console.log('MetricsCollector: Initializing');
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Start metrics collection
   */
  startCollection(interval: number = 30000): void {
    if (this.isCollecting) {
      console.log('Metrics collection is already running');
      return;
    }

    this.isCollecting = true;
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, interval);

    console.log(`Metrics collection started with ${interval}ms interval`);
  }

  /**
   * Stop metrics collection
   */
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
      this.isCollecting = false;
      console.log('Metrics collection stopped');
    }
  }

  /**
   * Collect current metrics
   */
  private collectMetrics(): void {
    try {
      const currentMetrics = performanceMonitor.getCurrentMetrics();
      this.addMetric('memory', currentMetrics.memoryUsage);
      this.addMetric('cpu', currentMetrics.cpuUsage);
      this.addMetric('detection', currentMetrics.detectionMetrics);
      
      console.log(`Metrics collected at ${currentMetrics.timestamp}`);
    } catch (error) {
      console.error('Error collecting metrics:', error);
      this.addMetric('error', { error: error.message });
    }
  }

  /**
   * Add a metric to the collection
   */
  addMetric(type: MetricsData['type'], value: any, metadata?: Record<string, any>): void {
    const metric: MetricsData = {
      timestamp: Date.now(),
      type,
      value,
      metadata
    };
    
    this.metrics.push(metric);
    
    // Keep metrics size limited
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics.shift();
    }
  }

  /**
   * Get metrics by type
   */
  getMetricsByType(type: MetricsData['type']): MetricsData[] {
    return this.metrics.filter(m => m.type === type);
  }

  /**
   * Get metrics by time range
   */
  getMetricsByTimeRange(startTime: number, endTime: number): MetricsData[] {
    return this.metrics.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    // Aggregate by type
    const byType = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.type]) {
        acc[metric.type] = [];
      }
      acc[metric.type].push(metric);
      return acc;
    }, {} as Record<string, MetricsData[]>);
    
    // Calculate aggregates for each type
    for (const [type, metrics] of Object.entries(byType)) {
      const values = metrics.map(m => m.value);
      
      if (type === 'memory') {
        const heapUsed = values.map(v => v.heapUsed);
        const heapTotal = values.map(v => v.heapTotal);
        const external = values.map(v => v.external);
        const rss = values.map(v => v.rss);
        
        result[type] = {
          average: {
            heapUsed: heapUsed.reduce((sum, v) => sum + v, 0) / heapUsed.length,
            heapTotal: heapTotal.reduce((sum, v) => sum + v, 0) / heapTotal.length,
            external: external.reduce((sum, v) => sum + v, 0) / external.length,
            rss: rss.reduce((sum, v) => sum + v, 0) / rss.length
          },
          max: {
            heapUsed: Math.max(...heapUsed),
            heapTotal: Math.max(...heapTotal),
            external: Math.max(...external),
            rss: Math.max(...rss)
          },
          min: {
            heapUsed: Math.min(...heapUsed),
            heapTotal: Math.min(...heapTotal),
            external: Math.min(...external),
            rss: Math.min(...rss)
          }
        };
      } else if (type === 'cpu') {
        const user = values.map(v => v.user);
        const system = values.map(v => v.system);
        
        result[type] = {
          average: {
            user: user.reduce((sum, v) => sum + v, 0) / user.length,
            system: system.reduce((sum, v) => sum + v, 0) / system.length
          },
          max: {
            user: Math.max(...user),
            system: Math.max(...system)
          },
          min: {
            user: Math.min(...user),
            system: Math.min(...system)
          }
        };
      } else if (type === 'detection') {
        const totalDetections = values.map(v => v.totalDetections);
        const averageProcessingTime = values.map(v => v.averageProcessingTime);
        const errorRate = values.map(v => v.errorRate);
        const cacheHitRate = values.map(v => v.cacheHitRate);
        
        result[type] = {
          average: {
            totalDetections: totalDetections.reduce((sum, v) => sum + v, 0) / totalDetections.length,
            averageProcessingTime: averageProcessingTime.reduce((sum, v) => sum + v, 0) / averageProcessingTime.length,
            errorRate: errorRate.reduce((sum, v) => sum + v, 0) / errorRate.length,
            cacheHitRate: cacheHitRate.reduce((sum, v) => sum + v, 0) / cacheHitRate.length
          },
          max: {
            totalDetections: Math.max(...totalDetections),
            averageProcessingTime: Math.max(...averageProcessingTime),
            errorRate: Math.max(...errorRate),
            cacheHitRate: Math.max(...cacheHitRate)
          },
          min: {
            totalDetections: Math.min(...totalDetections),
            averageProcessingTime: Math.min(...averageProcessingTime),
            errorRate: Math.min(...errorRate),
            cacheHitRate: Math.min(...cacheHitRate)
          }
        };
      }
    }
    
    return result;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): MetricsData[] {
    return [...this.metrics];
  }

  /**
   * Clear metrics history
   */
  clearHistory(): void {
    this.metrics = [];
    console.log('Metrics history cleared');
  }

  /**
   * Export metrics to JSON
   */
  exportToJson(): string {
    return JSON.stringify(this.metrics, null, 2);
  }

  /**
   * Import metrics from JSON
   */
  importFromJson(json: string): void {
    try {
      const imported = JSON.parse(json);
      if (Array.isArray(imported)) {
        this.metrics = imported;
        console.log(`Imported ${imported.length} metrics`);
      }
    } catch (error) {
      console.error('Error importing metrics:', error);
    }
  }
}

// Export singleton instance
export const metricsCollector = MetricsCollector.getInstance();
export default metricsCollector;