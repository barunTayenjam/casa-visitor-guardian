import { AppDataSource } from '../database.js';
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface VisitorReport {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  totalVisits: number;
  uniqueVisitors: number;
  knownVisitors: number;
  unknownVisitors: number;
  reportData: string;
  filePath?: string;
  createdAt: Date;
}

export interface VisitorSchedule {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  cronExpression: string;
  recipients: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Visitor {
  id: string;
  name?: string;
  type: 'known' | 'unknown';
  firstSeen: Date;
  lastSeen: Date;
  duration: number;
  cameraIds: string[];
  photos: string[];
  confidence: number;
  visitCount: number;
  lastSeenTimestamp: number;
}

export interface VisitorTimeline {
  date: string;
  visitors: Visitor[];
  summary: {
    totalVisitors: number;
    knownVisitors: number;
    unknownVisitors: number;
    totalDuration: number;
    averageVisitDuration: number;
    peakHours: Array<{ hour: number; count: number }>;
    cameras: Array<{ cameraId: string; count: number }>;
  };
}

export interface VisitorAnalytics {
  totalPeriod: {
    totalVisitors: number;
    uniqueVisitors: number;
    knownVisitors: number;
    unknownVisitors: number;
    totalVisits: number;
    averageVisitDuration: number;
  };
  trends: Array<{
    date: string;
    visitors: number;
    known: number;
    unknown: number;
  }>;
  patterns: {
    peakHours: Array<{ hour: number; count: number }>;
    peakDays: Array<{ day: number; count: number }>;
    cameraDistribution: Array<{ cameraId: string; count: number }>;
    frequentVisitors: Array<Visitor & { visitFrequency: number }>;
  };
  security: {
    unknownVisitorTrend: 'increasing' | 'decreasing' | 'stable';
    nightTimeVisits: number;
    unusualActivity: Array<{
      type: 'unusual_time' | 'unusual_location' | 'multiple_visits';
      description: string;
      timestamp: Date;
      confidence: number;
    }>;
  };
}

class VisitorDatabasePostgres {
  private isInitialized: boolean = false;
  private readonly eventsDir = path.join(__dirname, '../../public/events');
  private readonly batchResultsDir = path.join(__dirname, '../../public/batch-results');

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('Visitor PostgreSQL database already initialized');
      return;
    }

    try {
      console.log('Initializing visitor PostgreSQL database...');

      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }

      this.isInitialized = true;

      console.log('Visitor PostgreSQL database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize visitor PostgreSQL database:', error);
      throw error;
    }
  }

  // Get visitor schedules
  async getVisitorSchedules(): Promise<VisitorSchedule[]> {
    await this.initialize();

    try {
      const result = await AppDataSource.query(`
        SELECT * FROM visitor_schedules
        WHERE enabled = TRUE
        ORDER BY created_at ASC
      `);

      return result.map((row: any) => ({
        id: row.id,
        reportType: row.report_type,
        cronExpression: row.cron_expression,
        recipients: JSON.parse(row.recipients),
        enabled: Boolean(row.enabled),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Error getting visitor schedules:', error);
      return [];
    }
  }

  // Save visitor schedule
  async saveVisitorSchedule(schedule: Omit<VisitorSchedule, 'createdAt' | 'updatedAt' | 'id'>): Promise<string> {
    await this.initialize();

    const id = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await AppDataSource.query(`
      INSERT INTO visitor_schedules (
        id, report_type, cron_expression, recipients, enabled
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      id,
      schedule.reportType,
      schedule.cronExpression,
      JSON.stringify(schedule.recipients),
      schedule.enabled
    ]);

    return id;
  }

  // Save visitor report
  async saveVisitorReport(report: Omit<VisitorReport, 'createdAt'>): Promise<string> {
    await this.initialize();

    const id = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await AppDataSource.query(`
      INSERT INTO visitor_reports (
        id, report_type, period_start, period_end, total_visits,
        unique_visitors, known_visitors, unknown_visitors, report_data, file_path
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      id,
      report.reportType,
      report.periodStart,
      report.periodEnd,
      report.totalVisits,
      report.uniqueVisitors,
      report.knownVisitors,
      report.unknownVisitors,
      report.reportData,
      report.filePath || null
    ]);

    return id;
  }

  // Get visitor timeline
  async getVisitorTimeline(startDate: Date, endDate: Date): Promise<VisitorTimeline[]> {
    await this.initialize();

    try {
      console.log(`Fetching visitor timeline from PostgreSQL from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      const rows = await AppDataSource.query(`
        SELECT * FROM visitor_timeline
        WHERE date BETWEEN $1 AND $2
        ORDER BY first_seen DESC
      `, [
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      ]);

      const timelineMap = new Map<string, VisitorTimeline>();

      for (const row of rows) {
        const date = row.date;

        if (!timelineMap.has(date)) {
          timelineMap.set(date, {
            date,
            visitors: [],
            summary: {
              totalVisitors: 0,
              knownVisitors: 0,
              unknownVisitors: 0,
              totalDuration: 0,
              averageVisitDuration: 0,
              peakHours: [],
              cameras: []
            }
          });
        }

        const timelineDay = timelineMap.get(date)!;

        timelineDay.visitors.push({
          id: row.visitor_id || row.id,
          name: row.visitor_name,
          type: row.visitor_type as 'known' | 'unknown',
          firstSeen: new Date(row.first_seen),
          lastSeen: new Date(row.last_seen),
          duration: row.duration_minutes,
          cameraIds: JSON.parse(row.camera_ids || '["unknown"]'),
          photos: JSON.parse(row.photo_paths || '[]'),
          confidence: row.confidence,
          visitCount: row.visit_count,
          lastSeenTimestamp: new Date(row.last_seen).getTime()
        });
      }

      const timeline: VisitorTimeline[] = Array.from(timelineMap.values());

      for (const day of timeline) {
        day.summary.totalVisitors = day.visitors.length;
        day.summary.knownVisitors = day.visitors.filter(v => v.type === 'known').length;
        day.summary.unknownVisitors = day.visitors.filter(v => v.type === 'unknown').length;
        day.summary.totalDuration = day.visitors.reduce((sum, v) => sum + v.duration, 0);
        day.summary.averageVisitDuration = day.visitors.length > 0
          ? day.summary.totalDuration / day.visitors.length
          : 0;

        const hourCounts = new Map<number, number>();
        for (const visitor of day.visitors) {
          const hour = new Date(visitor.firstSeen).getHours();
          hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        }
        day.summary.peakHours = Array.from(hourCounts.entries())
          .map(([hour, count]) => ({ hour, count }))
          .sort((a, b) => b.count - a.count);

        const cameraCounts = new Map<string, number>();
        for (const visitor of day.visitors) {
          for (const cameraId of visitor.cameraIds) {
            cameraCounts.set(cameraId, (cameraCounts.get(cameraId) || 0) + 1);
          }
        }
        day.summary.cameras = Array.from(cameraCounts.entries())
          .map(([cameraId, count]) => ({ cameraId, count }))
          .sort((a, b) => b.count - a.count);
      }

      console.log(`Retrieved visitor timeline with ${timeline.length} days of data from PostgreSQL`);
      return timeline;
    } catch (error) {
      console.error('Error getting visitor timeline from PostgreSQL:', error);
      return [];
    }
  }

  // Store visitor timeline data from detection events
  async storeVisitorTimeline(visitors: Visitor[], date: string): Promise<void> {
    await this.initialize();

    try {
      await AppDataSource.query('BEGIN');

      for (const visitor of visitors) {
        const id = `vt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await AppDataSource.query(`
          INSERT INTO visitor_timeline (
            id, date, camera_id, visitor_type, visitor_id, visitor_name,
            first_seen, last_seen, duration_minutes, confidence, visit_count, photo_paths, camera_ids
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          id,
          date,
          visitor.cameraIds[0] || 'unknown',
          visitor.type,
          visitor.id,
          visitor.name || null,
          visitor.firstSeen.toISOString(),
          visitor.lastSeen.toISOString(),
          visitor.duration,
          visitor.confidence,
          visitor.visitCount,
          JSON.stringify(visitor.photos),
          JSON.stringify(visitor.cameraIds)
        ]);
      }

      await AppDataSource.query('COMMIT');
    } catch (error) {
      console.error('Error storing visitor timeline:', error);
      await AppDataSource.query('ROLLBACK');
      throw error;
    }
  }
}

// Singleton instance
let visitorDB: VisitorDatabasePostgres | null = null;

export async function getVisitorDatabase(): Promise<VisitorDatabasePostgres> {
  if (!visitorDB) {
    visitorDB = new VisitorDatabasePostgres();
    await visitorDB.initialize();
  }
  return visitorDB;
}

export default VisitorDatabasePostgres;
