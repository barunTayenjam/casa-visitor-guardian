import express from 'express';
import { visitorDatabase } from '../services/visitorDatabase.js';
import { visitorAnalyticsService } from '../services/visitorAnalyticsService.js';

export function configureVisitorRoutes(app: express.Application): void {
  const router = express.Router();

  // Simple CORS and JSON handling
  router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Authorization');
    next();
  });

  router.use(express.json());

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
      const schedules = await visitorDatabase.getVisitorSchedules();

      res.json({
        success: true,
        data: {
          schedules: schedules.map(schedule => ({
            ...schedule,
            nextExecution: new Date() // Placeholder
          }))
        }
      });

    } catch (error) {
      console.error('Error getting visitor report schedules:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get visitor report schedules',
        code: 'SCHEDULES_FETCH_FAILED'
      });
    }
  });

  // Generate visitor report
  router.post('/report/generate', async (req, res) => {
    try {
      console.log('*** VISITOR REPORT API CALLED ***');
      const { startDate, endDate } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required'
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      const analytics = await visitorAnalyticsService.generateVisitorReport(start, end);

      const reportId = await visitorDatabase.saveVisitorReport({
        id: `report_${Date.now()}`,
        reportType: 'daily',
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        totalVisits: analytics.totalPeriod.totalVisits,
        uniqueVisitors: analytics.totalPeriod.uniqueVisitors,
        knownVisitors: analytics.totalPeriod.knownVisitors,
        unknownVisitors: analytics.totalPeriod.unknownVisitors,
        reportData: JSON.stringify(analytics)
      });

      res.json({
        success: true,
        data: {
          reportId,
          analytics
        }
      });

    } catch (error) {
      console.error('Error generating visitor report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate visitor report'
      });
    }
  });

  // Schedule visitor report
  router.post('/schedule', async (req, res) => {
    try {
      console.log('*** VISITOR SCHEDULE CREATE API CALLED ***');
      const { reportType, cronExpression, recipients } = req.body;

      const scheduleId = await visitorDatabase.saveVisitorSchedule({
        reportType,
        cronExpression,
        recipients,
        enabled: true
      });

      res.json({
        success: true,
        data: {
          scheduleId,
          reportType,
          cronExpression,
          recipients
        }
      });

    } catch (error) {
      console.error('Error scheduling visitor report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule visitor report'
      });
    }
  });

  console.log('*** VISITOR ROUTES CONFIGURED ***');
  
  // Register routes
  app.use('/api/visitors', router);
}