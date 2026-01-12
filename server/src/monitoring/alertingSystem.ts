import { PerformanceMonitor } from './performanceMonitor.js';
import { logger } from '../utils/logger.js';

interface AlertConfig {
  type: 'memory' | 'cpu' | 'processing' | 'error' | 'stream';
  threshold: number;
  duration: number; // seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  notificationChannels: string[]; // 'email', 'slack', 'console', etc.
  enabled: boolean;
}

interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metrics: any;
  acknowledged: boolean;
  resolved: boolean;
  resolutionTime?: number;
}

interface AlertingSystemConfig {
  defaultThresholds: AlertConfig[];
  notificationChannels: {
    email: {
      enabled: boolean;
      recipients: string[];
    };
    slack: {
      enabled: boolean;
      webhookUrl: string;
    };
    console: {
      enabled: boolean;
    };
  };
  alertHistorySize: number;
}

class AlertingSystem {
  private performanceMonitor: PerformanceMonitor;
  private config: AlertingSystemConfig;
  private alerts: Alert[];
  private alertHistory: Map<string, Alert[]>;
  private alertCheckInterval: NodeJS.Timeout | null;

  constructor(performanceMonitor: PerformanceMonitor, config: Partial<AlertingSystemConfig> = {}) {
    this.performanceMonitor = performanceMonitor;
    this.config = this.getDefaultConfig(config);
    this.alerts = [];
    this.alertHistory = new Map();
    this.alertCheckInterval = null;
    
    this.setupEventListeners();
    this.startAlertMonitoring();
  }

  private getDefaultConfig(userConfig: Partial<AlertingSystemConfig>): AlertingSystemConfig {
    return {
      defaultThresholds: [
        { type: 'memory', threshold: 0.8, duration: 60, severity: 'medium', notificationChannels: ['console'], enabled: true },
        { type: 'cpu', threshold: 0.7, duration: 300, severity: 'medium', notificationChannels: ['console'], enabled: true },
        { type: 'processing', threshold: 1000, duration: 60, severity: 'medium', notificationChannels: ['console'], enabled: true },
        { type: 'error', threshold: 0.1, duration: 300, severity: 'high', notificationChannels: ['console'], enabled: true },
        { type: 'stream', threshold: 5000, duration: 30, severity: 'critical', notificationChannels: ['console'], enabled: true }
      ],
      notificationChannels: {
        email: { enabled: false, recipients: [] },
        slack: { enabled: false, webhookUrl: '' },
        console: { enabled: true }
      },
      alertHistorySize: 1000
    };
  }

  private setupEventListeners() {
    this.performanceMonitor.onAlert((alert) => {
      // TODO: Fix alert type mismatch
      // this.triggerAlert(alert.type, alert.severity, alert.metrics);
    });
  }

  private startAlertMonitoring() {
    this.alertCheckInterval = setInterval(() => {
      this.checkAlertConditions();
    }, 5000); // Check every 5 seconds
  }

  private stopAlertMonitoring() {
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = null;
    }
  }

  private checkAlertConditions() {
    const currentMetrics = this.performanceMonitor.getMetrics();
    
    this.config.defaultThresholds.forEach((threshold) => {
      if (!threshold.enabled) return;

      let alertTriggered = false;
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

      switch (threshold.type) {
        case 'memory':
          const memoryRatio = currentMetrics.memoryUsage.heapUsed / currentMetrics.memoryUsage.heapTotal;
          if (memoryRatio > threshold.threshold) {
            alertTriggered = true;
            severity = memoryRatio > 0.9 ? 'critical' : memoryRatio > 0.85 ? 'high' : 'medium';
          }
          break;
        case 'cpu':
          const cpuRatio = (currentMetrics.cpuUsage.user + currentMetrics.cpuUsage.system) / 2;
          if (cpuRatio > threshold.threshold) {
            alertTriggered = true;
            severity = cpuRatio > 0.9 ? 'critical' : cpuRatio > 0.8 ? 'high' : 'medium';
          }
          break;
        case 'processing':
          const avgProcessingTime = (
            currentMetrics.processingTime.objectDetection +
            currentMetrics.processingTime.facialRecognition +
            currentMetrics.processingTime.motionDetection
          ) / 3;
          if (avgProcessingTime > threshold.threshold) {
            alertTriggered = true;
            severity = avgProcessingTime > 2000 ? 'critical' : avgProcessingTime > 1500 ? 'high' : 'medium';
          }
          break;
        case 'error':
          if (currentMetrics.errorRate > threshold.threshold) {
            alertTriggered = true;
            severity = currentMetrics.errorRate > 0.2 ? 'critical' : currentMetrics.errorRate > 0.15 ? 'high' : 'medium';
          }
          break;
        case 'stream':
          if (currentMetrics.streamLatency > threshold.threshold) {
            alertTriggered = true;
            severity = currentMetrics.streamLatency > 8000 ? 'critical' : currentMetrics.streamLatency > 6000 ? 'high' : 'medium';
          }
          break;
      }

      if (alertTriggered) {
        this.triggerAlert(threshold, severity, currentMetrics);
      }
    });
  }

  private triggerAlert(threshold: AlertConfig, severity: 'low' | 'medium' | 'high' | 'critical', metrics: any) {
    const alertId = `${threshold.type}-${Date.now()}`;
    const alert: Alert = {
      id: alertId,
      type: threshold.type,
      severity,
      message: this.generateAlertMessage(threshold, severity),
      timestamp: Date.now(),
      metrics,
      acknowledged: false,
      resolved: false
    };

    this.alerts.push(alert);
    
    // Store in history
    const historyKey = threshold.type;
    if (!this.alertHistory.has(historyKey)) {
      this.alertHistory.set(historyKey, []);
    }
    this.alertHistory.get(historyKey)!.push(alert);

    // Keep history size limited
    if (this.alertHistory.get(historyKey)!.length > this.config.alertHistorySize) {
      this.alertHistory.set(historyKey, this.alertHistory.get(historyKey)!.slice(-this.config.alertHistorySize));
    }

    this.sendNotifications(alert);
    logger.warn(`Alert triggered: ${alert.message}`, { severity, metrics });
  }

  private generateAlertMessage(threshold: AlertConfig, severity: string): string {
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
      },
      stream: {
        low: 'Stream latency approaching threshold',
        medium: 'Stream latency at threshold',
        high: 'High stream latency detected',
        critical: 'CRITICAL: Stream latency exceeding threshold'
      }
    };

    return messages[threshold.type][severity as keyof typeof messages.memory];
  }

  private sendNotifications(alert: Alert) {
    const channels = this.config.notificationChannels;
    
    if (channels.console.enabled) {
      this.sendConsoleNotification(alert);
    }

    if (channels.email.enabled && channels.email.recipients.length > 0) {
      this.sendEmailNotification(alert);
    }

    if (channels.slack.enabled && channels.slack.webhookUrl) {
      this.sendSlackNotification(alert);
    }
  }

  private sendConsoleNotification(alert: Alert) {
    console.warn(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);
    console.warn(`Timestamp: ${new Date(alert.timestamp).toISOString()}`);
    console.warn(`Metrics:`, alert.metrics);
  }

  private sendEmailNotification(alert: Alert) {
    // Email notification would be implemented here
    logger.info('Would send email notification:', alert);
  }

  private sendSlackNotification(alert: Alert) {
    // Slack notification would be implemented here
    logger.info('Would send Slack notification:', alert);
  }

  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      logger.info(`Alert acknowledged: ${alertId}`);
      return true;
    }
    return false;
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolutionTime = Date.now();
      logger.info(`Alert resolved: ${alertId}`);
      return true;
    }
    return false;
  }

  public getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  public getAlertHistory(type?: string, hours: number = 24): Alert[] {
    const endTime = Date.now();
    const startTime = endTime - (hours * 60 * 60 * 1000);
    
    if (type) {
      const history = this.alertHistory.get(type) || [];
      return history.filter(alert => 
        alert.timestamp >= startTime && alert.timestamp <= endTime
      );
    }
    
    const allAlerts: Alert[] = [];
    this.alertHistory.forEach(history => {
      allAlerts.push(...history);
    });
    
    return allAlerts.filter(alert => 
      alert.timestamp >= startTime && alert.timestamp <= endTime
    );
  }

  public getAlertSummary(hours: number = 24): {
    totalAlerts: number;
    activeAlerts: number;
    resolvedAlerts: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const endTime = Date.now();
    const startTime = endTime - (hours * 60 * 60 * 1000);
    
    const allAlerts = this.getAlertHistory(undefined, hours);
    const activeAlerts = allAlerts.filter(alert => !alert.resolved);
    const resolvedAlerts = allAlerts.filter(alert => alert.resolved);
    
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    
    allAlerts.forEach(alert => {
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
    });

    return {
      totalAlerts: allAlerts.length,
      activeAlerts: activeAlerts.length,
      resolvedAlerts: resolvedAlerts.length,
      byType,
      bySeverity
    };
  }

  public setAlertConfig(config: Partial<AlertingSystemConfig>) {
    this.config = { ...this.config, ...config };
  }

  public getAlertConfig(): AlertingSystemConfig {
    return { ...this.config };
  }

  public cleanup() {
    this.stopAlertMonitoring();
    this.alerts = [];
    this.alertHistory.clear();
  }
}

export { AlertingSystem, AlertConfig, Alert, AlertingSystemConfig };