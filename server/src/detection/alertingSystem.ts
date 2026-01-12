import { performanceMonitor } from './performanceMonitor.js';

/**
 * Alert interface
 */
export interface Alert {
  id: string;
  type: 'memory' | 'cpu' | 'detection' | 'error';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
  acknowledged: boolean;
}

/**
 * Alerting system for performance monitoring
 */
export class AlertingSystem {
  private static instance: AlertingSystem;
  private alerts: Alert[] = [];
  private maxAlerts = 100; // Keep last 100 alerts
  private notificationInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {
    console.log('AlertingSystem: Initializing');
  }

  static getInstance(): AlertingSystem {
    if (!AlertingSystem.instance) {
      AlertingSystem.instance = new AlertingSystem();
    }
    return AlertingSystem.instance;
  }

  /**
   * Start alert monitoring
   */
  startMonitoring(interval: number = 60000): void {
    if (this.isRunning) {
      console.log('Alert monitoring is already running');
      return;
    }

    this.isRunning = true;
    this.notificationInterval = setInterval(() => {
      this.checkForAlerts();
    }, interval);

    console.log(`Alert monitoring started with ${interval}ms interval`);
  }

  /**
   * Stop alert monitoring
   */
  stopMonitoring(): void {
    if (this.notificationInterval) {
      clearInterval(this.notificationInterval);
      this.notificationInterval = null;
      this.isRunning = false;
      console.log('Alert monitoring stopped');
    }
  }

  /**
   * Check for performance alerts
   */
  private checkForAlerts(): void {
    try {
      const currentMetrics = performanceMonitor.getCurrentMetrics();
      const issues = performanceMonitor.checkForIssues();
      
      // Process each issue as an alert
      issues.forEach(issue => {
        this.createAlert('performance', 'warning', issue);
      });
      
      console.log(`Alert check completed: ${issues.length} issues found`);
    } catch (error) {
      this.createAlert('system', 'critical', `Alert check failed: ${error.message}`);
    }
  }

  /**
   * Create a new alert
   */
  createAlert(type: Alert['type'], severity: Alert['severity'], message: string): Alert {
    const alert: Alert = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      timestamp: Date.now(),
      resolved: false,
      acknowledged: false
    };
    
    this.alerts.push(alert);
    
    // Keep alerts size limited
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.shift();
    }
    
    console.log(`Alert created: [${severity}] ${message}`);
    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      console.log(`Alert resolved: ${alertId}`);
      return true;
    }
    return false;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      console.log(`Alert acknowledged: ${alertId}`);
      return true;
    }
    return false;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: Alert['type']): Alert[] {
    return this.alerts.filter(a => a.type === type);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: Alert['severity']): Alert[] {
    return this.alerts.filter(a => a.severity === severity);
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
    console.log('All alerts cleared');
  }

  /**
   * Send notification for alert
   */
  private sendNotification(alert: Alert): void {
    // In a real implementation, this would send notifications via email, Slack, etc.
    console.log(`[NOTIFICATION] ${alert.severity.toUpperCase()}: ${alert.message}`);
  }

  /**
   * Generate alert report
   */
  generateReport(): string {
    const activeAlerts = this.getActiveAlerts();
    const resolvedAlerts = this.alerts.filter(a => a.resolved);
    
    let report = 'Alert Report\n';
    report += '============\n\n';
    
    report += `Active Alerts: ${activeAlerts.length}\n`;
    report += `Resolved Alerts: ${resolvedAlerts.length}\n\n`;
    
    if (activeAlerts.length > 0) {
      report += 'Active Alerts:\n';
      activeAlerts.forEach(alert => {
        report += `- [${alert.severity}] ${alert.message} (ID: ${alert.id})\n`;
      });
    }
    
    if (resolvedAlerts.length > 0) {
      report += '\nResolved Alerts:\n';
      resolvedAlerts.forEach(alert => {
        report += `- [${alert.severity}] ${alert.message} (ID: ${alert.id})\n`;
      });
    }
    
    return report;
  }
}

// Export singleton instance
export const alertingSystem = AlertingSystem.getInstance();
export default alertingSystem;