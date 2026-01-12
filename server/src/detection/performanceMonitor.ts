import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { detectionCleanupService } from './cleanupService.js';
import { mlModelOptimizationTests } from './mlModelOptimizationTests.js';

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  timestamp: number;
  memoryUsage: {
    heapUsed: number; // MB
    heapTotal: number; // MB
    external: number; // MB
    rss: number; // MB
  };
  cpuUsage: {
    user: number; // %
    system: number; // %
  };
  detectionMetrics: {
    totalDetections: number;
    averageProcessingTime: number; // ms
    errorRate: number; // %
    cacheHitRate: number; // %
  };
  serviceStatus: {
    opencv: boolean;
    facialRecognition: boolean;
    consolidatedDetection: boolean;
    optimizedMotion: boolean;
  };
}

/**
 * Performance monitor service with comprehensive metrics collection
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 1000; // Keep last 1000 metrics entries
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private lastCpuInfo: os.CpuInfo[] = [];

  private constructor() {
    console.log('PerformanceMonitor: Initializing');
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(interval: number = 60000): void {
    if (this.isMonitoring) {
      console.log('Performance monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, interval);

    console.log(`Performance monitoring started with ${interval}ms interval`);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.isMonitoring = false;
      console.log('Performance monitoring stopped');
    }
  }

  /**
   * Collect current performance metrics
   */
  private collectMetrics(): void {
    try {
      const currentMetrics = this.getCurrentMetrics();
      this.metricsHistory.push(currentMetrics);
      
      // Keep history size limited
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }
      
      console.log(`Performance metrics collected: ${currentMetrics.timestamp}`);
    } catch (error) {
      console.error('Error collecting performance metrics:', error);
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    const now = Date.now();
    const memoryUsage = this.getMemoryUsage();
    const cpuUsage = this.getCpuUsage();
    const detectionMetrics = this.getDetectionMetrics();
    const serviceStatus = this.getServiceStatus();
    
    return {
      timestamp: now,
      memoryUsage,
      cpuUsage,
      detectionMetrics,
      serviceStatus
    };
  }

  /**
   * Get memory usage metrics
   */
  private getMemoryUsage(): PerformanceMetrics['memoryUsage'] {
    const memoryUsage = process.memoryUsage();
    
    return {
      heapUsed: memoryUsage.heapUsed / 1024 / 1024, // Convert to MB
      heapTotal: memoryUsage.heapTotal / 1024 / 1024,
      external: memoryUsage.external / 1024 / 1024,
      rss: memoryUsage.rss / 1024 / 1024
    };
  }

  /**
   * Get CPU usage metrics
   */
  private getCpuUsage(): PerformanceMetrics['cpuUsage'] {
    const cpus = os.cpus();
    
    // Calculate CPU usage since last measurement
    const cpuUsage = {
      user: 0,
      system: 0
    };
    
    if (this.lastCpuInfo.length > 0) {
      for (let i = 0; i < cpus.length; i++) {
        const last = this.lastCpuInfo[i];
        const current = cpus[i];
        
        if (last) {
          const userDiff = current.times.user - last.times.user;
          const systemDiff = current.times.sys - last.times.sys;
          const totalDiff = userDiff + systemDiff;
          
          const totalLast = (last.times.user + last.times.sys);
          const totalCurrent = (current.times.user + current.times.sys);
          const totalTime = totalCurrent - totalLast;
          
          if (totalTime > 0) {
            cpuUsage.user += (userDiff / totalTime) * 100;
            cpuUsage.system += (systemDiff / totalTime) * 100;
          }
        }
      }
      
      // Average across all CPUs
      cpuUsage.user /= cpus.length;
      cpuUsage.system /= cpus.length;
    }
    
    // Store current CPU info for next calculation
    this.lastCpuInfo = cpus.map(cpu => ({
      model: cpu.model,
      speed: cpu.speed,
      times: {
        user: cpu.times.user,
        nice: cpu.times.nice,
        sys: cpu.times.sys,
        idle: cpu.times.idle,
        irq: cpu.times.irq
      }
    }));
    
    return cpuUsage;
  }

  /**
   * Get detection service metrics
   */
  private getDetectionMetrics(): PerformanceMetrics['detectionMetrics'] {
    // This would be enhanced with actual detection service metrics
    // For now, using test results as a placeholder
    const testResults = mlModelOptimizationTests.getResults();
    const totalTests = testResults.size;
    const passedTests = Array.from(testResults.values()).filter(v => v).length;
    
    return {
      totalDetections: 0, // Placeholder - would be actual detection count
      averageProcessingTime: 0, // Placeholder - would be actual processing time
      errorRate: totalTests > 0 ? ((totalTests - passedTests) / totalTests) * 100 : 0,
      cacheHitRate: 0 // Placeholder - would be actual cache hit rate
    };
  }

  /**
   * Get service status
   */
  private getServiceStatus(): PerformanceMetrics['serviceStatus'] {
    return {
      opencv: true, // Placeholder - would check actual service status
      facialRecognition: true,
      consolidatedDetection: true,
      optimizedMotion: true
    };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Get average metrics over time period
   */
  getAverageMetrics(periodMs: number = 60000): Partial<PerformanceMetrics> {
    const now = Date.now();
    const recentMetrics = this.metricsHistory.filter(m => now - m.timestamp <= periodMs);
    
    if (recentMetrics.length === 0) {
      return {};
    }
    
    // Calculate averages
    const avgMemory = {
      heapUsed: recentMetrics.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) / recentMetrics.length,
      heapTotal: recentMetrics.reduce((sum, m) => sum + m.memoryUsage.heapTotal, 0) / recentMetrics.length,
      external: recentMetrics.reduce((sum, m) => sum + m.memoryUsage.external, 0) / recentMetrics.length,
      rss: recentMetrics.reduce((sum, m) => sum + m.memoryUsage.rss, 0) / recentMetrics.length
    };
    
    const avgCpu = {
      user: recentMetrics.reduce((sum, m) => sum + m.cpuUsage.user, 0) / recentMetrics.length,
      system: recentMetrics.reduce((sum, m) => sum + m.cpuUsage.system, 0) / recentMetrics.length
    };
    
    const avgDetection = {
      totalDetections: recentMetrics.reduce((sum, m) => sum + m.detectionMetrics.totalDetections, 0) / recentMetrics.length,
      averageProcessingTime: recentMetrics.reduce((sum, m) => sum + m.detectionMetrics.averageProcessingTime, 0) / recentMetrics.length,
      errorRate: recentMetrics.reduce((sum, m) => sum + m.detectionMetrics.errorRate, 0) / recentMetrics.length,
      cacheHitRate: recentMetrics.reduce((sum, m) => sum + m.detectionMetrics.cacheHitRate, 0) / recentMetrics.length
    };
    
    return {
      memoryUsage: avgMemory,
      cpuUsage: avgCpu,
      detectionMetrics: avgDetection
    };
  }

  /**
   * Check for performance issues
   */
  checkForIssues(): string[] {
    const issues: string[] = [];
    const currentMetrics = this.getCurrentMetrics();
    
    // Check memory usage
    if (currentMetrics.memoryUsage.heapUsed > 500) { // 500MB threshold
      issues.push(`High memory usage: ${currentMetrics.memoryUsage.heapUsed.toFixed(2)}MB`);
    }
    
    // Check CPU usage
    if (currentMetrics.cpuUsage.user > 80 || currentMetrics.cpuUsage.system > 80) { // 80% threshold
      issues.push(`High CPU usage: User ${currentMetrics.cpuUsage.user.toFixed(2)}%, System ${currentMetrics.cpuUsage.system.toFixed(2)}%`);
    }
    
    // Check error rate
    if (currentMetrics.detectionMetrics.errorRate > 10) { // 10% threshold
      issues.push(`High error rate: ${currentMetrics.detectionMetrics.errorRate.toFixed(2)}%`);
    }
    
    return issues;
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const current = this.getCurrentMetrics();
    const avg = this.getAverageMetrics(300000); // 5 minutes average
    
    let report = 'Performance Report\n';
    report += '================\n\n';
    
    report += 'Current Metrics:\n';
    report += `Timestamp: ${new Date(current.timestamp).toISOString()}\n`;
    report += `Memory Usage: Heap ${current.memoryUsage.heapUsed.toFixed(2)}MB / ${current.memoryUsage.heapTotal.toFixed(2)}MB\n`;
    report += `CPU Usage: User ${current.cpuUsage.user.toFixed(2)}%, System ${current.cpuUsage.system.toFixed(2)}%\n\n`;
    
    report += 'Average (5 minutes):\n';
    if (avg.memoryUsage) {
      report += `Memory Usage: Heap ${avg.memoryUsage.heapUsed.toFixed(2)}MB / ${avg.memoryUsage.heapTotal.toFixed(2)}MB\n`;
      report += `CPU Usage: User ${avg.cpuUsage.user.toFixed(2)}%, System ${avg.cpuUsage.system.toFixed(2)}%\n`;
    }
    
    const issues = this.checkForIssues();
    if (issues.length > 0) {
      report += '\nIssues Detected:\n';
      issues.forEach(issue => report += `- ${issue}\n`);
    } else {
      report += '\nNo issues detected.\n';
    }
    
    return report;
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();
export default performanceMonitor;