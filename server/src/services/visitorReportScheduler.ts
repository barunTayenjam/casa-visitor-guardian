import cron from 'node-cron';
import { visitorDatabase } from '../services/visitorDatabase.js';
import { visitorAnalyticsService } from '../services/visitorAnalyticsService.js';
import auditLogger from '../utils/auditLogger.js';
import fs from 'fs';
import path from 'path';

interface ScheduledReport {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  cronExpression: string;
  recipients: string[];
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

class VisitorReportScheduler {
  private scheduledReports: Map<string, ScheduledReport> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      console.log('Initializing visitor report scheduler...');
      
      // Load existing schedules from database
      const schedules = await visitorDatabase.getVisitorSchedules();
      
      for (const schedule of schedules) {
        if (schedule.enabled) {
          await this.scheduleReport(schedule);
        }
      }
      
      this.isInitialized = true;
      console.log(`Visitor report scheduler initialized with ${this.scheduledReports.size} active schedules`);
      
      // Log initialization
      await auditLogger.logEvent('VISITOR_REPORT_SCHEDULER_INITIALIZED', {
        activeSchedules: this.scheduledReports.size,
        cronJobsCount: this.cronJobs.size
      });
      
    } catch (error) {
      console.error('Failed to initialize visitor report scheduler:', error);
      throw error;
    }
  }

  // Schedule a new report
  async scheduleReport(schedule: any): Promise<void> {
    const reportId = schedule.id || schedule.scheduleId;
    
    if (!reportId) {
      throw new Error('Report ID is required');
    }

    const scheduledReport: ScheduledReport = {
      id: reportId,
      reportType: schedule.reportType,
      cronExpression: schedule.cronExpression,
      recipients: Array.isArray(schedule.recipients) ? schedule.recipients : JSON.parse(schedule.recipients || '[]'),
      enabled: schedule.enabled !== false
    };

    // Validate cron expression
    if (!cron.validate(schedule.cronExpression)) {
      throw new Error(`Invalid cron expression: ${schedule.cronExpression}`);
    }

    // Stop existing job if any
    if (this.cronJobs.has(reportId)) {
      this.cronJobs.get(reportId)?.stop();
      this.cronJobs.delete(reportId);
    }

    // Create new cron job
    const task = cron.schedule(schedule.cronExpression, async () => {
      await this.executeScheduledReport(scheduledReport);
    }, {
      scheduled: false, // Don't start immediately
      timezone: 'America/New_York' // Configure based on your timezone
    });

    this.cronJobs.set(reportId, task);
    this.scheduledReports.set(reportId, scheduledReport);
    
    // Start the job
    task.start();
    
    console.log(`Scheduled visitor report ${reportId} with cron: ${schedule.cronExpression}`);
    
    await auditLogger.logEvent('VISITOR_REPORT_SCHEDULED', {
      reportId,
      reportType: schedule.reportType,
      cronExpression: schedule.cronExpression,
      recipients: scheduledReport.recipients
    });
  }

  // Execute a scheduled report
  private async executeScheduledReport(scheduledReport: ScheduledReport): Promise<void> {
    const { id, reportType, recipients } = scheduledReport;
    
    try {
      console.log(`Executing scheduled visitor report: ${id} (${reportType})`);
      
      // Calculate date range based on report type
      const { startDate, endDate } = this.getDateRangeForReportType(reportType);
      
      // Generate the report
      const analytics = await visitorAnalyticsService.generateVisitorReport(startDate, endDate);
      
      // Save report to database
      const reportData = {
        analytics,
        generatedAt: new Date().toISOString(),
        reportType,
        scheduleId: id,
        recipients,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      };

      const reportId = await visitorDatabase.saveVisitorReport({
        id: `scheduled_${id}_${Date.now()}`,
        reportType,
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
        totalVisits: analytics.totalPeriod.totalVisits,
        uniqueVisitors: analytics.totalPeriod.uniqueVisitors,
        knownVisitors: analytics.totalPeriod.knownVisitors,
        unknownVisitors: analytics.totalPeriod.unknownVisitors,
        reportData: JSON.stringify(reportData)
      });

      // Generate report file (PDF/HTML)
      const reportFilePath = await this.generateReportFile(analytics, reportType, startDate, endDate);
      
      // Send email notifications
      await this.sendReportEmails(recipients, analytics, reportFilePath, reportType, startDate, endDate);
      
      // Update schedule with last run time
      scheduledReport.lastRun = new Date();
      
      console.log(`Successfully executed scheduled report ${id}. Report ID: ${reportId}`);
      
      await auditLogger.logEvent('VISITOR_REPORT_EXECUTED', {
        scheduleId: id,
        reportId,
        reportType,
        recipients,
        totalVisitors: analytics.totalPeriod.uniqueVisitors,
        knownVisitors: analytics.totalPeriod.knownVisitors,
        unknownVisitors: analytics.totalPeriod.unknownVisitors,
        reportFilePath
      });
      
    } catch (error) {
      console.error(`Error executing scheduled report ${id}:`, error);
      
      await auditLogger.logEvent('VISITOR_REPORT_EXECUTION_FAILED', {
        scheduleId: id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Implement retry logic or notification here
      // For now, just log the error
    }
  }

  // Get date range for report type
  private getDateRangeForReportType(reportType: 'daily' | 'weekly' | 'monthly'): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (reportType) {
      case 'daily':
        // Previous day
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(now);
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'weekly':
        // Previous week (Monday to Sunday)
        const daysSinceMonday = (now.getDay() + 6) % 7;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - daysSinceMonday - 7);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'monthly':
        // Previous month
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        break;

      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }

    return { startDate, endDate };
  }

  // Generate report file (HTML or PDF)
  private async generateReportFile(
    analytics: any,
    reportType: 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `visitor_report_${reportType}_${timestamp}.html`;
    const filePath = path.join(__dirname, '../../public/reports', filename);

    // Ensure reports directory exists
    const reportsDir = path.dirname(filePath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate HTML report
    const htmlContent = this.generateHTMLReport(analytics, reportType, startDate, endDate);
    fs.writeFileSync(filePath, htmlContent);

    console.log(`Generated report file: ${filePath}`);
    return filePath;
  }

  // Generate HTML report content
  private generateHTMLReport(
    analytics: any,
    reportType: 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ): string {
    const reportTitle = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Visitor Report`;
    const dateRange = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportTitle}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 1.1em;
        }
        .content {
            padding: 30px;
        }
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            border-left: 4px solid #667eea;
        }
        .card h3 {
            margin: 0 0 10px 0;
            color: #667eea;
            font-size: 2em;
            font-weight: 600;
        }
        .card p {
            margin: 0;
            color: #666;
            font-weight: 500;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .chart-container {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .security-alert {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 15px;
        }
        .security-alert.high {
            background: #f8d7da;
            border-color: #f5c6cb;
        }
        .security-alert.medium {
            background: #fff3cd;
            border-color: #ffeaa7;
        }
        .security-alert.low {
            background: #d1ecf1;
            border-color: #bee5eb;
        }
        .trend-up {
            color: #28a745;
            font-weight: bold;
        }
        .trend-down {
            color: #dc3545;
            font-weight: bold;
        }
        .trend-stable {
            color: #6c757d;
            font-weight: bold;
        }
        .recommendations {
            background: #e7f3ff;
            border-left: 4px solid #2196F3;
            padding: 15px;
            border-radius: 4px;
        }
        .recommendations ul {
            margin: 10px 0 0 0;
            padding-left: 20px;
        }
        .recommendations li {
            margin-bottom: 8px;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #666;
            border-top: 1px solid #dee2e6;
        }
        @media (max-width: 768px) {
            .summary-cards {
                grid-template-columns: 1fr;
            }
            body {
                padding: 10px;
            }
            .content {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${reportTitle}</h1>
            <p>${dateRange}</p>
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>

        <div class="content">
            <!-- Summary Cards -->
            <div class="summary-cards">
                <div class="card">
                    <h3>${analytics.totalPeriod.uniqueVisitors}</h3>
                    <p>Unique Visitors</p>
                </div>
                <div class="card">
                    <h3>${analytics.totalPeriod.knownVisitors}</h3>
                    <p>Known Visitors</p>
                </div>
                <div class="card">
                    <h3>${analytics.totalPeriod.unknownVisitors}</h3>
                    <p>Unknown Visitors</p>
                </div>
                <div class="card">
                    <h3>${analytics.totalPeriod.totalVisits}</h3>
                    <p>Total Visits</p>
                </div>
                <div class="card">
                    <h3>${Math.round(analytics.totalPeriod.averageVisitDuration)}m</h3>
                    <p>Avg Visit Duration</p>
                </div>
                <div class="card">
                    <h3>${analytics.security.nightTimeVisits}</h3>
                    <p>Night Activity</p>
                </div>
            </div>

            <!-- Visitor Trends -->
            <div class="section">
                <h2>Visitor Trends</h2>
                <div class="chart-container">
                    <h3>Daily Visitor Count</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                        ${analytics.trends.map((trend: any) => `
                            <div style="text-align: center; padding: 10px; background: white; border-radius: 4px; min-width: 80px;">
                                <div style="font-size: 0.9em; color: #666;">${new Date(trend.date).toLocaleDateString()}</div>
                                <div style="font-size: 1.2em; font-weight: bold; color: #667eea;">${trend.visitors}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Activity Patterns -->
            <div class="section">
                <h2>Activity Patterns</h2>
                <div class="chart-container">
                    <h3>Peak Activity Hours</h3>
                    <div style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 5px;">
                        ${Array.from({ length: 24 }, (_, i) => {
                            const hourData = analytics.patterns.peakHours.find((h: any) => h.hour === i);
                            const count = hourData ? hourData.count : 0;
                            const maxCount = Math.max(...analytics.patterns.peakHours.map((h: any) => h.count));
                            const intensity = maxCount > 0 ? (count / maxCount) * 100 : 0;
                            
                            return `
                                <div style="
                                    text-align: center;
                                    padding: 8px;
                                    background: linear-gradient(to top, #667eea ${intensity}%, #f8f9fa ${intensity}%);
                                    border-radius: 4px;
                                    font-size: 0.8em;
                                ">
                                    <div>${i}:00</div>
                                    <div style="font-weight: bold;">${count}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="chart-container">
                    <h3>Camera Activity Distribution</h3>
                    ${analytics.patterns.cameraDistribution.map((camera: any) => `
                        <div style="margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <span>${camera.cameraId}</span>
                                <span style="font-weight: bold;">${camera.count} visits</span>
                            </div>
                            <div style="background: #e9ecef; border-radius: 4px; height: 20px;">
                                <div style="
                                    background: #667eea;
                                    height: 100%;
                                    border-radius: 4px;
                                    width: ${(camera.count / Math.max(...analytics.patterns.cameraDistribution.map((c: any) => c.count))) * 100}%;
                                "></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Security Analysis -->
            <div class="section">
                <h2>Security Analysis</h2>
                
                <div class="chart-container">
                    <h3>Security Level: <span class="trend-${this.getSecurityTrendClass(analytics)}">${this.getSecurityLevel(analytics).toUpperCase()}</span></h3>
                    <p>Night-time activity detected: ${analytics.security.nightTimeVisits} visits</p>
                    <p>Unusual activities: ${analytics.security.unusualActivity.length} events</p>
                </div>

                ${analytics.security.unusualActivity.length > 0 ? `
                    <h3>Unusual Activities</h3>
                    ${analytics.security.unusualActivity.slice(0, 5).map((activity: any) => `
                        <div class="security-alert ${activity.severity}">
                            <strong>${activity.type.replace('_', ' ').toUpperCase()}</strong>
                            <p>${activity.description}</p>
                            <small>${new Date(activity.timestamp).toLocaleString()}</small>
                        </div>
                    `).join('')}
                ` : '<p>No unusual activities detected during this period.</p>'}

                <div class="recommendations">
                    <h3>Security Recommendations</h3>
                    <ul>
                        ${this.generateSecurityRecommendations(analytics).map((rec: string) => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <!-- Frequent Visitors -->
            ${analytics.patterns.frequentVisitors.length > 0 ? `
                <div class="section">
                    <h2>Frequent Visitors</h2>
                    <div class="chart-container">
                        ${analytics.patterns.frequentVisitors.slice(0, 10).map((visitor: any) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #dee2e6;">
                                <div>
                                    <strong>${visitor.name || 'Unknown Visitor'}</strong>
                                    <span style="margin-left: 10px; padding: 2px 8px; background: ${visitor.type === 'known' ? '#d4edda' : '#f8d7da'}; border-radius: 12px; font-size: 0.8em;">
                                        ${visitor.type === 'known' ? 'Known' : 'Unknown'}
                                    </span>
                                </div>
                                <div style="text-align: right;">
                                    <div>${visitor.visitCount} visits</div>
                                    <div style="font-size: 0.9em; color: #666;">Last seen: ${new Date(visitor.lastSeen).toLocaleDateString()}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>

        <div class="footer">
            <p>This report was automatically generated by Home Security Visitor Analytics System</p>
            <p>For questions or concerns, please contact your system administrator</p>
        </div>
    </div>
</body>
</html>`;
  }

  // Get security level from analytics
  private getSecurityLevel(analytics: any): string {
    const nightTimeRatio = analytics.security.nightTimeVisits / analytics.totalPeriod.totalVisits;
    const unusualActivityRatio = analytics.security.unusualActivity.length / analytics.totalPeriod.totalVisits;
    const unknownRatio = analytics.totalPeriod.unknownVisitors / analytics.totalPeriod.uniqueVisitors;
    
    if (nightTimeRatio > 0.3 || unusualActivityRatio > 0.2 || unknownRatio > 0.7) {
      return 'high';
    } else if (nightTimeRatio > 0.15 || unusualActivityRatio > 0.1 || unknownRatio > 0.4) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  // Get security trend class for CSS
  private getSecurityTrendClass(analytics: any): string {
    const level = this.getSecurityLevel(analytics);
    return level === 'low' ? 'stable' : level === 'medium' ? 'down' : 'down';
  }

  // Generate security recommendations
  private generateSecurityRecommendations(analytics: any): string[] {
    const recommendations: string[] = [];
    
    if (analytics.security.nightTimeVisits > 10) {
      recommendations.push('Consider reviewing night-time security protocols and improving lighting');
    }
    
    if (analytics.security.unusualActivity.length > 5) {
      recommendations.push('Multiple unusual activities detected - review camera placements and detection sensitivity');
    }
    
    if (analytics.totalPeriod.unknownVisitors > analytics.totalPeriod.knownVisitors) {
      recommendations.push('High number of unknown visitors - consider updating known persons database');
    }
    
    const peakCamera = analytics.patterns.cameraDistribution
      .sort((a: any, b: any) => b.count - a.count)[0];
    
    if (peakCamera && peakCamera.count > analytics.totalPeriod.totalVisits * 0.7) {
      recommendations.push(`Most activity detected at ${peakCamera.cameraId} - ensure optimal camera positioning`);
    }
    
    if (analytics.totalPeriod.averageVisitDuration < 5) {
      recommendations.push('Very short visit durations detected - may indicate false positives or quick-access attempts');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Security posture looks good for this period');
    }
    
    return recommendations;
  }

  // Send report emails (placeholder implementation)
  private async sendReportEmails(
    recipients: string[],
    analytics: any,
    reportFilePath: string,
    reportType: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    console.log(`Sending ${reportType} visitor report to ${recipients.length} recipients`);
    
    // This would integrate with your email service
    // For now, we'll just log what would be sent
    
    for (const recipient of recipients) {
      const emailContent = {
        to: recipient,
        subject: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Visitor Report - ${startDate.toLocaleDateString()}`,
        text: `
Dear User,

Please find attached the ${reportType} visitor report covering the period from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}.

Report Summary:
- Total Unique Visitors: ${analytics.totalPeriod.uniqueVisitors}
- Known Visitors: ${analytics.totalPeriod.knownVisitors}
- Unknown Visitors: ${analytics.totalPeriod.unknownVisitors}
- Total Visits: ${analytics.totalPeriod.totalVisits}
- Average Visit Duration: ${Math.round(analytics.totalPeriod.averageVisitDuration)} minutes
- Night-time Activity: ${analytics.security.nightTimeVisits} visits
- Security Level: ${this.getSecurityLevel(analytics).toUpperCase()}

The detailed HTML report is attached to this email.

Best regards,
Home Security System
        `,
        attachments: [
          {
            filename: `visitor_report_${reportType}_${new Date().toISOString().split('T')[0]}.html`,
            path: reportFilePath
          }
        ]
      };
      
      console.log(`Would send email to ${recipient}:`, emailContent.subject);
      
      // In a real implementation, you would use nodemailer or similar:
      // await emailService.sendEmail(emailContent);
    }
  }

  // Update schedule
  async updateSchedule(scheduleId: string, updates: Partial<ScheduledReport>): Promise<void> {
    const existing = this.scheduledReports.get(scheduleId);
    if (!existing) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    // Stop existing cron job
    if (this.cronJobs.has(scheduleId)) {
      this.cronJobs.get(scheduleId)?.stop();
      this.cronJobs.delete(scheduleId);
    }

    // Update schedule
    const updatedSchedule = { ...existing, ...updates };
    
    if (updates.enabled && updates.cronExpression) {
      // Reschedule with new parameters
      await this.scheduleReport(updatedSchedule);
    } else {
      // Just update the stored schedule
      this.scheduledReports.set(scheduleId, updatedSchedule);
    }

    await auditLogger.logEvent('VISITOR_REPORT_SCHEDULE_UPDATED', {
      scheduleId,
      updates,
      enabled: updatedSchedule.enabled
    });
  }

  // Delete schedule
  async deleteSchedule(scheduleId: string): Promise<void> {
    // Stop cron job
    if (this.cronJobs.has(scheduleId)) {
      this.cronJobs.get(scheduleId)?.stop();
      this.cronJobs.delete(scheduleId);
    }

    // Remove from schedules
    this.scheduledReports.delete(scheduleId);

    console.log(`Deleted visitor report schedule: ${scheduleId}`);
    
    await auditLogger.logEvent('VISITOR_REPORT_SCHEDULE_DELETED', {
      scheduleId
    });
  }

  // Get all scheduled reports
  getScheduledReports(): ScheduledReport[] {
    return Array.from(this.scheduledReports.values());
  }

  // Get scheduled report by ID
  getScheduledReport(scheduleId: string): ScheduledReport | undefined {
    return this.scheduledReports.get(scheduleId);
  }

  // Manual report generation
  async generateManualReport(reportType: 'daily' | 'weekly' | 'monthly', customStartDate?: Date, customEndDate?: Date): Promise<string> {
    const { startDate, endDate } = customStartDate && customEndDate 
      ? { startDate: customStartDate, endDate: customEndDate }
      : this.getDateRangeForReportType(reportType);

    console.log(`Generating manual ${reportType} report from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const analytics = await visitorAnalyticsService.generateVisitorReport(startDate, endDate);
    
    // Save report to database
    const reportData = {
      analytics,
      generatedAt: new Date().toISOString(),
      reportType,
      isManual: true,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    };

    const reportId = await visitorDatabase.saveVisitorReport({
      id: `manual_${reportType}_${Date.now()}`,
      reportType,
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      totalVisits: analytics.totalPeriod.totalVisits,
      uniqueVisitors: analytics.totalPeriod.uniqueVisitors,
      knownVisitors: analytics.totalPeriod.knownVisitors,
      unknownVisitors: analytics.totalPeriod.unknownVisitors,
      reportData: JSON.stringify(reportData)
    });

    // Generate report file
    const reportFilePath = await this.generateReportFile(analytics, reportType, startDate, endDate);

    await auditLogger.logEvent('VISITOR_REPORT_MANUAL_GENERATION', {
      reportId,
      reportType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      reportFilePath
    });

    return reportFilePath;
  }

  // Cleanup resources
  async shutdown(): Promise<void> {
    console.log('Shutting down visitor report scheduler...');
    
    // Stop all cron jobs
    for (const [scheduleId, task] of this.cronJobs.entries()) {
      task.stop();
      console.log(`Stopped cron job for schedule: ${scheduleId}`);
    }
    
    this.cronJobs.clear();
    this.scheduledReports.clear();
    
    await auditLogger.logEvent('VISITOR_REPORT_SCHEDULER_SHUTDOWN', {
      activeSchedules: this.scheduledReports.size
    });
    
    console.log('Visitor report scheduler shutdown complete');
  }
}

export const visitorReportScheduler = new VisitorReportScheduler();