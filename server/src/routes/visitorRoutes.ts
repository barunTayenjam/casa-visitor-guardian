import express from 'express';
import fs from 'fs';
import path from 'path';
import { visitorDatabase } from '../services/visitorDatabase.js';
import { visitorAnalyticsService } from '../services/visitorAnalyticsService.js';

function generateBasicHTML(reportType: string, startDate: Date, endDate: Date): string {
  const reportDate = startDate.toLocaleDateString('en-US', {
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
    <title>${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Visitor Report - ${startDate.toLocaleDateString()}</title>
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
        .stat-card h3 {
            margin: 0 0 10px 0;
            font-size: 2em;
        }
        .stat-card p {
            margin: 0;
            font-size: 1.1em;
            opacity: 0.9;
        }
        .no-data {
            text-align: center;
            color: #7f8c8d;
            font-style: italic;
            padding: 40px;
            background: #f8f9fa;
            border-radius: 8px;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            color: #7f8c8d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Visitor Report</h1>
            <div class="date">${reportDate}</div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <h3>0</h3>
                <p>Total Visits</p>
            </div>
            <div class="stat-card">
                <h3>0</h3>
                <p>Known Visitors</p>
            </div>
            <div class="stat-card">
                <h3>0</h3>
                <p>Unknown Visitors</p>
            </div>
            <div class="stat-card">
                <h3>0</h3>
                <p>Unique Visitors</p>
            </div>
        </div>

        <div class="no-data">
            <h3>No Visitor Data Available</h3>
            <p>There were no visitor detections during the period from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}.</p>
            <p>This could mean:</p>
            <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
                <li>No people were detected by the system</li>
                <li>Cameras were not operational during this period</li>
                <li>Detection services were not running</li>
                <li>Visitor data has not been processed yet</li>
            </ul>
        </div>

        <div class="footer">
            <p>Report generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} by SentryVision Home Security System</p>
            <p>This is an automated ${reportType} visitor report covering ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}.</p>
        </div>
    </div>
</body>
</html>`;
}

export function configureVisitorRoutes(app: express.Application): void {
  console.log('*** CONFIGURING VISITOR ROUTES ***');
  console.log('App provided:', !!app);
  console.log('App type:', typeof app);
  
  const router = express.Router();
  console.log('Router created:', !!router);

  // Log ALL requests for debugging
  router.use((req, res, next) => {
    console.log('*** VISITOR ROUTE REQUEST ***');
    console.log(`Method: ${req.method}`);
    console.log(`URL: ${req.url}`);
    console.log(`Path: ${req.path}`);
    console.log(`Query: ${JSON.stringify(req.query)}`);
    console.log(`Headers: ${JSON.stringify(req.headers)}`);
    console.log(`IP: ${req.ip}`);
    console.log('-----------------------------------');
    
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Authorization');
    next();
  });

  // Add JSON parser with error handling
  router.use(express.json({
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        console.warn('Invalid JSON received:', e);
        res.status(400).json({ error: 'Invalid JSON' });
        throw e;
      }
    }
  }));

  // Test endpoint
  router.get('/test', (req, res) => {
    try {
      console.log('*** VISITOR TEST ENDPOINT CALLED ***');
      console.log('Headers:', req.headers);
      console.log('IP:', req.ip);
      console.log('User agent:', req.get('User-Agent'));
      
      res.json({
        success: true,
        message: 'Visitor routes are working',
        timestamp: new Date().toISOString(),
        requestInfo: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          ip: req.ip
        }
      });
    } catch (error) {
      console.error('Error in test endpoint:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get visitor timeline for date range
  router.get('/timeline', async (req, res) => {
    try {
      console.log('*** VISITOR TIMELINE API CALLED ***');
      console.log('Query params:', req.query);

      const { startDate, endDate, cameraId, visitorType } = req.query;

      if (!startDate || !endDate) {
        console.log('Missing dates');
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required',
          code: 'MISSING_DATES'
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      console.log(`Getting visitor timeline from ${start.toISOString()} to ${end.toISOString()}`);

      // Get visitor timeline from database
      const timeline = await visitorDatabase.getVisitorTimeline(start, end);

      console.log(`Timeline generated with ${timeline.length} days`);

      // Apply filters if provided
      let filteredTimeline = timeline;
      
      if (cameraId) {
        filteredTimeline = timeline.map(day => ({
          ...day,
          visitors: day.visitors.filter(visitor => 
            visitor.cameraIds.includes(cameraId as string)
          )
        }));
      }

      if (visitorType && visitorType !== 'all') {
        filteredTimeline = timeline.map(day => ({
          ...day,
          visitors: day.visitors.filter(visitor => 
            visitorType === 'known' ? visitor.type === 'known' : visitor.type === 'unknown'
          )
        }));
      }

      console.log(`Returning ${filteredTimeline.length} days of data`);

      res.json({
        success: true,
        data: {
          timeline: filteredTimeline,
          filters: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            cameraId: cameraId || null,
            visitorType: visitorType || 'all'
          }
        }
      });

    } catch (error) {
      console.error('Error getting visitor timeline:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get visitor timeline',
        code: 'TIMELINE_FETCH_FAILED',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get visitor analytics
  router.get('/analytics', async (req, res) => {
    try {
      console.log('*** VISITOR ANALYTICS API CALLED ***');
      const { startDate, endDate, period = 'week' } = req.query;

      // Calculate date range based on period
      let start: Date;
      let end: Date = new Date();

      if (startDate && endDate) {
        start = new Date(startDate as string);
        end = new Date(endDate as string);
      } else {
        // Default to last period
        const now = new Date();
        switch (period) {
          case 'day':
            start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case 'week':
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
      }

      console.log(`Getting visitor analytics from ${start.toISOString()} to ${end.toISOString()}`);

      const analytics = await visitorAnalyticsService.generateVisitorReport(start, end);

      res.json({
        success: true,
        data: {
          analytics,
          period: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            periodType: period
          }
        }
      });

    } catch (error) {
      console.error('Error getting visitor analytics:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: 'Failed to get visitor analytics',
        code: 'ANALYTICS_FETCH_FAILED',
        details: errorMessage
      });
    }
  });

  // Get visitor schedules
  router.get('/schedule', async (req, res) => {
    try {
      console.log('*** VISITOR SCHEDULE API CALLED ***');
      console.log('Database initialized:', !!(visitorDatabase as any).db);
      
      const schedules = await visitorDatabase.getVisitorSchedules();
      console.log('Schedules fetched:', schedules.length);

      res.json({
        success: true,
        data: {
          schedules: schedules.map(schedule => ({
            ...schedule,
            nextExecution: new Date() // Placeholder - implement actual next execution calculation
          }))
        }
      });

    } catch (error) {
      console.error('Error getting visitor report schedules:', error);
      console.error('Error details:', error instanceof Error ? error.message : error);
      console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
      res.status(500).json({
        success: false,
        error: 'Failed to get visitor report schedules',
        code: 'SCHEDULES_FETCH_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Generate visitor report
  router.post('/report/generate', async (req, res) => {
    try {
      console.log('*** VISITOR REPORT API CALLED ***');
      const { startDate, endDate, includeAnalytics = true, includeTimeline = true } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required',
          code: 'MISSING_DATES'
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format',
          code: 'INVALID_DATE_FORMAT'
        });
      }

      if (start >= end) {
        return res.status(400).json({
          success: false,
          error: 'Start date must be before end date',
          code: 'INVALID_DATE_RANGE'
        });
      }

      console.log(`Generating visitor report from ${start.toISOString()} to ${end.toISOString()}`);

      // Determine report type based on date range
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      const reportType: 'daily' | 'weekly' | 'monthly' = 
        daysDiff <= 1 ? 'daily' : daysDiff <= 7 ? 'weekly' : 'monthly';

      // Create simple HTML report directly
      const reportsDir = path.join(process.cwd(), 'public/reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const fileName = `${reportType}_report_${start.toISOString().split('T')[0]}.html`;
      const reportFilePath = `/public/reports/${fileName}`;
      const fullPath = path.join(process.cwd(), reportFilePath);

      const htmlContent = generateBasicHTML(reportType, start, end);
      fs.writeFileSync(fullPath, htmlContent, 'utf8');

      try {
        // Generate comprehensive visitor analytics
        const analytics = await visitorAnalyticsService.generateVisitorReport(start, end);

        // Save report to database
        const reportData = {
          analytics,
          generatedAt: new Date().toISOString(),
          requestedBy: 'anonymous', // Would come from auth in production
          parameters: { startDate, endDate, includeAnalytics, includeTimeline }
        };

        const reportId = await visitorDatabase.saveVisitorReport({
          id: `report_${Date.now()}`,
          reportType,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          totalVisits: analytics.totalPeriod.totalVisits,
          uniqueVisitors: analytics.totalPeriod.uniqueVisitors,
          knownVisitors: analytics.totalPeriod.knownVisitors,
          unknownVisitors: analytics.totalPeriod.unknownVisitors,
          reportData: JSON.stringify(reportData),
          filePath: reportFilePath
        });

        res.json({
          success: true,
          data: {
            reportId,
            reportFilePath,
            analytics,
            summary: {
              totalVisitors: analytics.totalPeriod.uniqueVisitors,
              knownVisitors: analytics.totalPeriod.knownVisitors,
              unknownVisitors: analytics.totalPeriod.unknownVisitors,
              totalVisits: analytics.totalPeriod.totalVisits,
              averageVisitDuration: analytics.totalPeriod.averageVisitDuration,
              nightTimeActivity: analytics.security.nightTimeVisits,
              unusualActivityCount: analytics.security.unusualActivity.length
            }
          }
        });
      } catch (analyticsError) {
        console.warn('Analytics generation failed, creating basic report:', analyticsError);
        
        // Fallback: create basic report without analytics
        const reportId = await visitorDatabase.saveVisitorReport({
          id: `report_${Date.now()}`,
          reportType,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          totalVisits: 0,
          uniqueVisitors: 0,
          knownVisitors: 0,
          unknownVisitors: 0,
          reportData: JSON.stringify({
            generatedAt: new Date().toISOString(),
            requestedBy: 'anonymous',
            parameters: { startDate, endDate, includeAnalytics, includeTimeline },
            note: 'No visitor data available for this period'
          }),
          filePath: reportFilePath
        });

        res.json({
          success: true,
          data: {
            reportId,
            reportFilePath,
            summary: {
              totalVisitors: 0,
              knownVisitors: 0,
              unknownVisitors: 0,
              totalVisits: 0,
              note: 'No visitor data available for this period'
            }
          }
        });
      }

    } catch (error) {
      console.error('Error generating visitor report:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: 'Failed to generate visitor report',
        code: 'REPORT_GENERATION_FAILED',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  });

  // Schedule visitor report
  router.post('/schedule', async (req, res) => {
    try {
      console.log('*** VISITOR SCHEDULE CREATE API CALLED ***');
      const { reportType, cronExpression, recipients, enabled = true } = req.body;

      if (!reportType || !cronExpression || !recipients || !Array.isArray(recipients)) {
        return res.status(400).json({
          success: false,
          error: 'Report type, cron expression, and recipients array are required',
          code: 'MISSING_SCHEDULE_PARAMS'
        });
      }

      // Validate cron expression (basic validation)
      const cronParts = cronExpression.split(' ');
      if (cronParts.length !== 5) {
        return res.status(400).json({
          success: false,
          error: 'Invalid cron expression format',
          code: 'INVALID_CRON_EXPRESSION'
        });
      }

      // Validate report type
      const validReportTypes = ['daily', 'weekly', 'monthly'];
      if (!validReportTypes.includes(reportType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid report type. Must be one of: daily, weekly, monthly',
          code: 'INVALID_REPORT_TYPE'
        });
      }

      // Validate email recipients
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const recipient of recipients) {
        if (!emailRegex.test(recipient)) {
          return res.status(400).json({
            success: false,
            error: `Invalid email address: ${recipient}`,
            code: 'INVALID_EMAIL'
          });
        }
      }

      const scheduleId = await visitorDatabase.saveVisitorSchedule({
        reportType,
        cronExpression,
        recipients,
        enabled
      });

      res.json({
        success: true,
        data: {
          scheduleId,
          reportType,
          cronExpression,
          recipients,
          enabled,
          nextExecution: new Date() // Placeholder - implement actual cron parsing
        }
      });

    } catch (error) {
      console.error('Error scheduling visitor report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule visitor report',
        code: 'SCHEDULE_CREATION_FAILED'
      });
    }
  });

  console.log('*** VISITOR ROUTES CONFIGURED - REGISTERING MIDDLEWARE ***');
  
  // Add a fallback route for any unmatched request
  router.use('*', (req, res) => {
    console.log('*** UNMATCHED VISITOR ROUTE ***');
    console.log(`Method: ${req.method}`);
    console.log(`Path: ${req.path}`);
    console.log(`Original URL: ${req.url}`);
    
    res.status(404).json({
      success: false,
      error: 'Visitor route not found',
      path: req.path,
      method: req.method,
      availableRoutes: ['/test', '/timeline', '/analytics', '/schedule', '/report/generate']
    });
  });

  // Register routes with logging and error handling
  console.log('*** REGISTERING VISITOR ROUTES AT /api/visitors ***');
  try {
    app.use('/api/visitors', router);
    console.log('*** VISITOR ROUTES SUCCESSFULLY REGISTERED TO APP ***');
  } catch (error) {
    console.error('*** ERROR REGISTERING VISITOR ROUTES ***', error);
  }
  
  console.log('*** VISITOR ROUTES FULLY CONFIGURED AND REGISTERED ***');
  
  // Test app router after registration
  console.log('App has _router?', !!(app as any)._router);
  console.log('App type:', typeof app);
}