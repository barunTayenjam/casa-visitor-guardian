import { performanceMonitor } from './performanceMonitor.js';
import { metricsCollector } from './metricsCollector.js';

/**
 * Dashboard widget interface
 */
export interface DashboardWidget {
  id: string;
  title: string;
  type: 'gauge' | 'chart' | 'table' | 'alert';
  data: any;
  config: Record<string, any>;
}

/**
 * Performance dashboard service for visualization and reporting
 */
export class PerformanceDashboard {
  private static instance: PerformanceDashboard;
  private widgets: DashboardWidget[] = [];
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {
    console.log('PerformanceDashboard: Initializing');
  }

  static getInstance(): PerformanceDashboard {
    if (!PerformanceDashboard.instance) {
      PerformanceDashboard.instance = new PerformanceDashboard();
    }
    return PerformanceDashboard.instance;
  }

  /**
   * Start dashboard updates
   */
  startUpdates(interval: number = 5000): void {
    if (this.isRunning) {
      console.log('Dashboard updates are already running');
      return;
    }

    this.isRunning = true;
    this.updateInterval = setInterval(() => {
      this.updateDashboard();
    }, interval);

    console.log(`Dashboard updates started with ${interval}ms interval`);
  }

  /**
   * Stop dashboard updates
   */
  stopUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      this.isRunning = false;
      console.log('Dashboard updates stopped');
    }
  }

  /**
   * Update all dashboard widgets
   */
  private updateDashboard(): void {
    try {
      const currentMetrics = performanceMonitor.getCurrentMetrics();
      const aggregatedMetrics = metricsCollector.getAggregatedMetrics();
      
      // Update memory widget
      this.updateMemoryWidget(currentMetrics.memoryUsage, aggregatedMetrics.memory);
      
      // Update CPU widget
      this.updateCpuWidget(currentMetrics.cpuUsage, aggregatedMetrics.cpu);
      
      // Update detection widget
      this.updateDetectionWidget(currentMetrics.detectionMetrics, aggregatedMetrics.detection);
      
      // Update alerts widget
      this.updateAlertsWidget();
      
      console.log('Dashboard updated');
    } catch (error) {
      console.error('Error updating dashboard:', error);
    }
  }

  /**
   * Update memory widget
   */
  private updateMemoryWidget(current: any, aggregated: any): void {
    const memoryWidget = this.getWidgetById('memory');
    if (memoryWidget) {
      memoryWidget.data = {
        current: {
          heapUsed: current.heapUsed,
          heapTotal: current.heapTotal,
          external: current.external,
          rss: current.rss
        },
        aggregated: {
          average: aggregated.average,
          max: aggregated.max,
          min: aggregated.min
        }
      };
    }
  }

  /**
   * Update CPU widget
   */
  private updateCpuWidget(current: any, aggregated: any): void {
    const cpuWidget = this.getWidgetById('cpu');
    if (cpuWidget) {
      cpuWidget.data = {
        current: {
          user: current.user,
          system: current.system
        },
        aggregated: {
          average: aggregated.average,
          max: aggregated.max,
          min: aggregated.min
        }
      };
    }
  }

  /**
   * Update detection widget
   */
  private updateDetectionWidget(current: any, aggregated: any): void {
    const detectionWidget = this.getWidgetById('detection');
    if (detectionWidget) {
      detectionWidget.data = {
        current: {
          totalDetections: current.totalDetections,
          averageProcessingTime: current.averageProcessingTime,
          errorRate: current.errorRate,
          cacheHitRate: current.cacheHitRate
        },
        aggregated: {
          average: aggregated.average,
          max: aggregated.max,
          min: aggregated.min
        }
      };
    }
  }

  /**
   * Update alerts widget
   */
  private updateAlertsWidget(): void {
    const alertsWidget = this.getWidgetById('alerts');
    if (alertsWidget) {
      const issues = performanceMonitor.checkForIssues();
      alertsWidget.data = {
        issues,
        timestamp: Date.now(),
        severity: issues.length > 0 ? 'warning' : 'info'
      };
    }
  }

  /**
   * Get widget by ID
   */
  private getWidgetById(id: string): DashboardWidget | undefined {
    return this.widgets.find(w => w.id === id);
  }

  /**
   * Add widget to dashboard
   */
  addWidget(widget: DashboardWidget): void {
    this.widgets.push(widget);
    console.log(`Added widget: ${widget.id}`);
  }

  /**
   * Remove widget from dashboard
   */
  removeWidget(id: string): void {
    this.widgets = this.widgets.filter(w => w.id !== id);
    console.log(`Removed widget: ${id}`);
  }

  /**
   * Get all widgets
   */
  getWidgets(): DashboardWidget[] {
    return [...this.widgets];
  }

  /**
   * Generate dashboard HTML
   */
  generateHtml(): string {
    let html = '<div class="performance-dashboard">\n';
    
    for (const widget of this.widgets) {
      html += this.generateWidgetHtml(widget);
    }
    
    html += '</div>';
    return html;
  }

  /**
   * Generate widget HTML
   */
  private generateWidgetHtml(widget: DashboardWidget): string {
    let html = `<div class="widget widget-${widget.type}" id="${widget.id}">\n`;
    html += `<h3>${widget.title}</h3>\n`;
    
    if (widget.type === 'gauge') {
      html += this.generateGaugeHtml(widget.data);
    } else if (widget.type === 'chart') {
      html += this.generateChartHtml(widget.data);
    } else if (widget.type === 'table') {
      html += this.generateTableHtml(widget.data);
    } else if (widget.type === 'alert') {
      html += this.generateAlertHtml(widget.data);
    }
    
    html += '</div>\n';
    return html;
  }

  /**
   * Generate gauge HTML
   */
  private generateGaugeHtml(data: any): string {
    // Simplified gauge representation
    return `<div class="gauge">
      <div class="gauge-value">${data.current.toFixed(2)}</div>
      <div class="gauge-label">${data.label}</div>
    </div>`;
  }

  /**
   * Generate chart HTML
   */
  private generateChartHtml(data: any): string {
    // Simplified chart representation
    return `<div class="chart">
      <div class="chart-title">${data.title}</div>
      <div class="chart-content">${JSON.stringify(data)}</div>
    </div>`;
  }

  /**
   * Generate table HTML
   */
  private generateTableHtml(data: any): string {
    // Simplified table representation
    return `<div class="table">
      <div class="table-title">${data.title}</div>
      <div class="table-content">${JSON.stringify(data)}</div>
    </div>`;
  }

  /**
   * Generate alert HTML
   */
  private generateAlertHtml(data: any): string {
    // Simplified alert representation
    const severityClass = data.severity === 'warning' ? 'warning' : 'info';
    return `<div class="alert alert-${severityClass}">
      <div class="alert-title">System Status</div>
      <div class="alert-content">
        ${data.issues.length > 0 ? data.issues.join('<br>') : 'No issues detected'}
      </div>
    </div>`;
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const report = performanceMonitor.generateReport();
    const aggregated = metricsCollector.getAggregatedMetrics();
    
    let fullReport = report + '\n\n';
    fullReport += 'Aggregated Metrics:\n';
    fullReport += '==================\n\n';
    
    for (const [type, metrics] of Object.entries(aggregated)) {
      fullReport += `${type.toUpperCase()} Metrics:\n`;
      fullReport += JSON.stringify(metrics, null, 2) + '\n\n';
    }
    
    return fullReport;
  }
}

// Export singleton instance
export const performanceDashboard = PerformanceDashboard.getInstance();
export default performanceDashboard;