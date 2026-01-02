import fs from 'node:fs';
import path from 'path';
import { visitorDatabase } from './visitorDatabase.js';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ReportData {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  totalVisits: number;
  uniqueVisitors: number;
  knownVisitors: number;
  unknownVisitors: number;
  visitors: any[];
  timeline: any[];
  cameraStats: any[];
}

export class VisitorReportGenerator {
  private readonly reportsDir = path.join(__dirname, '../../public/reports');

  constructor() {
    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async generateReport(
    reportType: 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    console.log(`Generating ${reportType} report from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get visitor data for the period
    const timeline = await visitorDatabase.getVisitorTimeline(startDate, endDate);
    const analytics = await this.generateAnalytics(timeline);

    const reportData: ReportData = {
      id: `${reportType}_report_${startDate.toISOString().split('T')[0]}`,
      reportType,
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      totalVisits: analytics.totalVisits,
      uniqueVisitors: analytics.uniqueVisitors,
      knownVisitors: analytics.knownVisitors,
      unknownVisitors: analytics.unknownVisitors,
      visitors: analytics.allVisitors,
      timeline: timeline,
      cameraStats: analytics.cameraStats
    };

    // Generate HTML content
    const htmlContent = this.generateHTML(reportData);

    // Save to file
    const fileName = `${reportType}_report_${startDate.toISOString().split('T')[0]}.html`;
    const filePath = path.join(this.reportsDir, fileName);
    
    fs.writeFileSync(filePath, htmlContent, 'utf8');
    console.log(`Report saved to: ${filePath}`);

    return `/public/reports/${fileName}`;
  }

  private async generateAnalytics(timeline: any[]): Promise<any> {
    const allVisitors: any[] = [];
    const cameraStats = new Map();
    let totalVisits = 0;

    timeline.forEach(day => {
      day.visitors.forEach((visitor: any) => {
        totalVisits += visitor.visitCount || 1;
        
        // Track unique visitors
        if (!allVisitors.find(v => v.id === visitor.id)) {
          allVisitors.push(visitor);
        }

        // Track camera stats
        visitor.cameraIds.forEach((cameraId: string) => {
          if (!cameraStats.has(cameraId)) {
            cameraStats.set(cameraId, { cameraId, detections: 0, visitors: new Set() });
          }
          const stats = cameraStats.get(cameraId);
          stats.detections++;
          stats.visitors.add(visitor.id);
        });
      });
    });

    const knownVisitors = allVisitors.filter(v => v.type === 'known').length;
    const unknownVisitors = allVisitors.filter(v => v.type === 'unknown').length;

    // Convert camera stats Map to array
    const cameraStatsArray = Array.from(cameraStats.values()).map(stats => ({
      cameraId: stats.cameraId,
      detections: stats.detections,
      uniqueVisitors: stats.visitors.size
    }));

    return {
      totalVisits,
      uniqueVisitors: allVisitors.length,
      knownVisitors,
      unknownVisitors,
      allVisitors,
      cameraStats: cameraStatsArray
    };
  }

  private generateHTML(data: ReportData): string {
    const reportDate = new Date(data.periodStart).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.reportType.charAt(0).toUpperCase() + data.reportType.slice(1)} Visitor Report - ${new Date(data.periodStart).toLocaleDateString()}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
        }
        .header h1 {
            color: #2c3e50;
            margin: 0;
            font-size: 2.5em;
        }
        .header .date {
            color: #7f8c8d;
            font-size: 1.2em;
            margin-top: 10px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-card.known {
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        }
        .stat-card.unknown {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
        }
        .stat-card h3 {
            margin: 0 0 10px 0;
            font-size: 2em;
        }
        .stat-card p {
            margin: 0;
            font-size: 1.1em;
            opacity: 0.9;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .visitor-list {
            list-style: none;
            padding: 0;
        }
        .visitor-item {
            background: #f8f9fa;
            margin-bottom: 10px;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #3498db;
        }
        .visitor-item.known {
            border-left-color: #4CAF50;
        }
        .visitor-item.unknown {
            border-left-color: #ff6b6b;
        }
        .visitor-name {
            font-weight: bold;
            font-size: 1.1em;
        }
        .visitor-details {
            color: #666;
            font-size: 0.9em;
            margin-top: 5px;
        }
        .timeline {
            position: relative;
            padding-left: 30px;
        }
        .timeline::before {
            content: '';
            position: absolute;
            left: 10px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #3498db;
        }
        .timeline-item {
            position: relative;
            margin-bottom: 20px;
            background: white;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .timeline-item::before {
            content: '';
            position: absolute;
            left: -25px;
            top: 20px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #3498db;
        }
        .timeline-time {
            font-weight: bold;
            color: #3498db;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            color: #7f8c8d;
        }
        .no-data {
            text-align: center;
            color: #7f8c8d;
            font-style: italic;
            padding: 40px;
            background: #f8f9fa;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${data.reportType.charAt(0).toUpperCase() + data.reportType.slice(1)} Visitor Report</h1>
            <div class="date">${reportDate}</div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <h3>${data.totalVisits}</h3>
                <p>Total Visits</p>
            </div>
            <div class="stat-card known">
                <h3>${data.knownVisitors}</h3>
                <p>Known Visitors</p>
            </div>
            <div class="stat-card unknown">
                <h3>${data.unknownVisitors}</h3>
                <p>Unknown Visitors</p>
            </div>
            <div class="stat-card">
                <h3>${data.uniqueVisitors}</h3>
                <p>Unique Visitors</p>
            </div>
        </div>

        ${data.visitors.length > 0 ? `
        <div class="section">
            <h2>Visitor Summary</h2>
            <ul class="visitor-list">
                ${data.visitors.map(visitor => `
                <li class="visitor-item ${visitor.type}">
                    <div class="visitor-name">${visitor.name || `${visitor.type === 'known' ? 'Known' : 'Unknown'} Person #${visitor.id.slice(-6)}`}</div>
                    <div class="visitor-details">${visitor.visitCount || 1} visits • First seen: ${new Date(visitor.firstSeen).toLocaleTimeString()} • Last seen: ${new Date(visitor.lastSeen).toLocaleTimeString()}</div>
                </li>
                `).join('')}
            </ul>
        </div>
        ` : `
        <div class="section">
            <h2>Visitor Summary</h2>
            <div class="no-data">No visitors detected during this period.</div>
        </div>
        `}

        ${data.timeline.length > 0 ? `
        <div class="section">
            <h2>Activity Timeline</h2>
            <div class="timeline">
                ${data.timeline.slice(0, 10).map(day => `
                    ${day.visitors.slice(0, 3).map((visitor: any) => `
                    <div class="timeline-item">
                        <div class="timeline-time">${new Date(visitor.lastSeen).toLocaleString()}</div>
                        <div>${visitor.name || `${visitor.type === 'known' ? 'Known' : 'Unknown'} Person`} detected at ${visitor.cameraIds.join(', ')}</div>
                    </div>
                    `).join('')}
                `).join('')}
            </div>
        </div>
        ` : ''}

        ${data.cameraStats.length > 0 ? `
        <div class="section">
            <h2>Camera Activity</h2>
            <ul class="visitor-list">
                ${data.cameraStats.map(camera => `
                <li class="visitor-item">
                    <div class="visitor-name">${camera.cameraId}</div>
                    <div class="visitor-details">${camera.detections} detections • ${camera.uniqueVisitors} unique visitors</div>
                </li>
                `).join('')}
            </ul>
        </div>
        ` : ''}

        <div class="footer">
            <p>Report generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} by SentryVision Home Security System</p>
            <p>This is an automated ${data.reportType} visitor report covering ${new Date(data.periodStart).toLocaleDateString()} to ${new Date(data.periodEnd).toLocaleDateString()}.</p>
        </div>
    </div>
</body>
</html>`;
  }
}

export const visitorReportGenerator = new VisitorReportGenerator();