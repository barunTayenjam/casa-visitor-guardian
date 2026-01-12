import { PerformanceMonitor } from './performanceMonitor.js';
import { MetricsCollector } from './metricsCollector.js';
import { logger } from '../utils/logger.js';

interface DashboardConfig {
  refreshInterval: number;
  alertThresholds: any;
  visualizationSettings: {
    showCharts: boolean;
    showAlerts: boolean;
    showMetrics: boolean;
  };
}

interface DashboardData {
  systemHealth: number;
  memoryUsage: {
    current: number;
    peak: number;
    average: number;
    trend: number[];
  };
  cpuUsage: {
    current: number;
    peak: number;
    average: number;
    trend: number[];
  };
  processingTime: {
    current: number;
    peak: number;
    average: number;
    trend: number[];
  };
  errorRate: {
    current: number;
    trend: number[];
  };
  cacheHitRate: {
    current: number;
    trend: number[];
  };
  streamLatency: {
    current: number;
    trend: number[];
  };
  recentAlerts: any[];
  aggregatedMetrics: any;
}

class PerformanceDashboard {
  private performanceMonitor: PerformanceMonitor;
  private metricsCollector: MetricsCollector;
  private config: DashboardConfig;
  private dashboardData: DashboardData;
  private refreshInterval: NodeJS.Timeout | null;
  private dataUpdateCallbacks: Function[];

  constructor(performanceMonitor: PerformanceMonitor, metricsCollector: MetricsCollector, config: Partial<DashboardConfig> = {}) {
    this.performanceMonitor = performanceMonitor;
    this.metricsCollector = metricsCollector;
    this.config = {
      refreshInterval: config.refreshInterval || 30000, // 30 seconds
      alertThresholds: config.alertThresholds || {},
      visualizationSettings: config.visualizationSettings || {
        showCharts: true,
        showAlerts: true,
        showMetrics: true
      }
    };
    this.dashboardData = this.initializeDashboardData();
    this.dataUpdateCallbacks = [];
    this.refreshInterval = null;
    
    this.startDataRefresh();
    this.setupEventListeners();
  }

  private initializeDashboardData(): DashboardData {
    return {
      systemHealth: 100,
      memoryUsage: {
        current: 0,
        peak: 0,
        average: 0,
        trend: []
      },
      cpuUsage: {
        current: 0,
        peak: 0,
        average: 0,
        trend: []
      },
      processingTime: {
        current: 0,
        peak: 0,
        average: 0,
        trend: []
      },
      errorRate: {
        current: 0,
        trend: []
      },
      cacheHitRate: {
        current: 0,
        trend: []
      },
      streamLatency: {
        current: 0,
        trend: []
      },
      recentAlerts: [],
      aggregatedMetrics: {}
    };
  }

  private setupEventListeners() {
    this.performanceMonitor.onAlert((alert) => {
      this.updateRecentAlerts(alert);
    });

    this.metricsCollector.on('systemMetrics', (metrics) => {
      this.updateSystemMetrics(metrics);
    });
  }

  private startDataRefresh() {
    this.refreshInterval = setInterval(() => {
      this.refreshDashboardData();
    }, this.config.refreshInterval);
  }

  private stopDataRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private refreshDashboardData() {
    try {
      // Get current metrics
      const currentMetrics = this.performanceMonitor.getMetrics();
      const aggregatedMetrics = this.metricsCollector.getAggregatedMetrics(1); // Last hour
      
      // Update dashboard data
      this.dashboardData.systemHealth = this.performanceMonitor.getSystemHealthScore();
      this.dashboardData.memoryUsage.current = currentMetrics.memoryUsage.heapUsed;
      this.dashboardData.cpuUsage.current = currentMetrics.cpuUsage.user + currentMetrics.cpuUsage.system;
      this.dashboardData.processingTime.current = (currentMetrics.processingTime.objectDetection + 
                                             currentMetrics.processingTime.facialRecognition + 
                                             currentMetrics.processingTime.motionDetection) / 3;
      this.dashboardData.errorRate.current = currentMetrics.errorRate;
      this.dashboardData.cacheHitRate.current = currentMetrics.cacheHitRate;
      this.dashboardData.streamLatency.current = currentMetrics.streamLatency;
      this.dashboardData.aggregatedMetrics = aggregatedMetrics;

      // Trigger callbacks
      this.dataUpdateCallbacks.forEach(callback => {
        callback(this.dashboardData);
      });
    } catch (error) {
      logger.error('Error refreshing dashboard data:', error);
    }
  }

  private updateRecentAlerts(alert: any) {
    this.dashboardData.recentAlerts.unshift(alert);
    
    // Keep only last 10 alerts
    if (this.dashboardData.recentAlerts.length > 10) {
      this.dashboardData.recentAlerts = this.dashboardData.recentAlerts.slice(0, 10);
    }
  }

  private updateSystemMetrics(metrics: any) {
    // Update with system metrics if available
    if (metrics.memory) {
      this.dashboardData.memoryUsage.current = metrics.memory.heapUsed;
    }
  }

  public onDataUpdate(callback: (data: DashboardData) => void) {
    this.dataUpdateCallbacks.push(callback);
    // Immediately call with current data
    callback(this.dashboardData);
  }

  public getDashboardData(): DashboardData {
    return { ...this.dashboardData };
  }

  public getVisualizationData() {
    const data = this.getDashboardData();
    
    return {
      systemHealth: data.systemHealth,
      memory: {
        current: data.memoryUsage.current,
        peak: data.memoryUsage.peak,
        average: data.memoryUsage.average,
        trend: data.memoryUsage.trend
      },
      cpu: {
        current: data.cpuUsage.current,
        peak: data.cpuUsage.peak,
        average: data.cpuUsage.average,
        trend: data.cpuUsage.trend
      },
      processingTime: {
        current: data.processingTime.current,
        peak: data.processingTime.peak,
        average: data.processingTime.average,
        trend: data.processingTime.trend
      },
      errorRate: {
        current: data.errorRate.current,
        trend: data.errorRate.trend
      },
      cacheHitRate: {
        current: data.cacheHitRate.current,
        trend: data.cacheHitRate.trend
      },
      streamLatency: {
        current: data.streamLatency.current,
        trend: data.streamLatency.trend
      }
    };
  }

  public getAlertSummary() {
    const data = this.getDashboardData();
    return {
      totalAlerts: data.recentAlerts.length,
      recentAlerts: data.recentAlerts,
      systemHealth: data.systemHealth
    };
  }

  public getPerformanceSummary() {
    const data = this.getDashboardData();
    return {
      systemHealth: data.systemHealth,
      memoryUsage: {
        current: data.memoryUsage.current,
        peak: data.memoryUsage.peak,
        average: data.memoryUsage.average
      },
      cpuUsage: {
        current: data.cpuUsage.current,
        peak: data.cpuUsage.peak,
        average: data.cpuUsage.average
      },
      processingTime: {
        current: data.processingTime.current,
        peak: data.processingTime.peak,
        average: data.processingTime.average
      },
      errorRate: data.errorRate.current,
      cacheHitRate: data.cacheHitRate.current,
      streamLatency: data.streamLatency.current
    };
  }

  public exportDashboardData(format: 'json' | 'csv' = 'json'): string {
    const data = this.getDashboardData();
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // CSV export would be implemented here
      return JSON.stringify(data);
    }
  }

  public reset() {
    this.dashboardData = this.initializeDashboardData();
    this.refreshDashboardData();
  }

  public cleanup() {
    this.stopDataRefresh();
    this.dataUpdateCallbacks = [];
  }
}

export { PerformanceDashboard, DashboardConfig, DashboardData };