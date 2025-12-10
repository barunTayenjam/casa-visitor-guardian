import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { glob } from 'glob';
import { facialRecognitionService } from '../detection/facialRecognition.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to promisify sqlite3 methods
function runQuery(db: sqlite3.Database, query: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

function getAllQuery(db: sqlite3.Database, query: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function getQuery(db: sqlite3.Database, query: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function execQuery(db: sqlite3.Database, query: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(query, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export interface VisitorReport {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  totalVisits: number;
  uniqueVisitors: number;
  knownVisitors: number;
  unknownVisitors: number;
  reportData: string; // JSON with detailed analytics
  filePath?: string;
  createdAt: string;
}

export interface VisitorSchedule {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  cronExpression: string;
  recipients: string[]; // Array of email addresses
  enabled: boolean;
  createdAt: string;
}

export interface Visitor {
  id: string;
  name?: string;
  type: 'known' | 'unknown';
  firstSeen: Date;
  lastSeen: Date;
  duration: number; // minutes
  cameraIds: string[];
  photos: string[]; // image paths
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

class VisitorDatabase {
  private db: sqlite3.Database | null = null;
  private readonly dbPath = path.join(__dirname, '../../data/visitors.db');
  private readonly eventsDir = path.join(__dirname, '../../public/events');
  private readonly batchResultsDir = path.join(__dirname, '../../public/batch-results');

  async initialize(): Promise<void> {
    // Check if already initialized
    if (this.db) {
      console.log('Visitor database already initialized');
      return;
    }

    try {
      console.log('Initializing visitor database...');
      
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        console.log(`Creating data directory: ${dataDir}`);
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Ensure events directory exists
      if (!fs.existsSync(this.eventsDir)) {
        console.log(`Creating events directory: ${this.eventsDir}`);
        fs.mkdirSync(this.eventsDir, { recursive: true });
      }

      // Ensure batch results directory exists
      if (!fs.existsSync(this.batchResultsDir)) {
        console.log(`Creating batch results directory: ${this.batchResultsDir}`);
        fs.mkdirSync(this.batchResultsDir, { recursive: true });
      }

      console.log(`Opening database at: ${this.dbPath}`);
      console.log('Database file exists:', fs.existsSync(this.dbPath));
      
      // Open database using sqlite3 with callback
      await new Promise<void>((resolve, reject) => {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            console.error('Error opening database:', err);
            reject(err);
            return;
          }
          console.log('Database opened successfully with sqlite3');
          resolve();
        });
      });

      console.log('Creating tables...');
      await this.createTables();
      
      // Populate database with existing file data (migration)
      await this.migrateFileDataToDatabase();
      
      console.log('Visitor database initialized successfully');
      console.log(`Database path: ${this.dbPath}`);
      
    } catch (error) {
      console.error('Failed to initialize visitor database:', error);
      console.error('Error details:', error instanceof Error ? error.stack : String(error));
      // Don't throw error to prevent server crash, just continue without visitor database
      console.warn('Continuing without visitor database functionality');
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Visitor reports table
      await execQuery(this.db, `
        CREATE TABLE IF NOT EXISTS visitor_reports (
          id TEXT PRIMARY KEY,
          report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
          period_start TEXT NOT NULL,
          period_end TEXT NOT NULL,
          total_visits INTEGER DEFAULT 0,
          unique_visitors INTEGER DEFAULT 0,
          known_visitors INTEGER DEFAULT 0,
          unknown_visitors INTEGER DEFAULT 0,
          report_data TEXT NOT NULL,
          file_path TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Visitor schedules table
      await execQuery(this.db, `
        CREATE TABLE IF NOT EXISTS visitor_schedules (
          id TEXT PRIMARY KEY,
          report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
          cron_expression TEXT NOT NULL,
          recipients TEXT NOT NULL,
          enabled BOOLEAN DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Visitor timeline table - stores individual visitor events and timeline data
      await execQuery(this.db, `
        CREATE TABLE IF NOT EXISTS visitor_timeline (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          camera_id TEXT NOT NULL,
          visitor_type TEXT NOT NULL CHECK (visitor_type IN ('known', 'unknown')),
          visitor_id TEXT,
          visitor_name TEXT,
          first_seen TIMESTAMP NOT NULL,
          last_seen TIMESTAMP NOT NULL,
          duration_minutes INTEGER DEFAULT 0,
          confidence REAL DEFAULT 0.0,
          visit_count INTEGER DEFAULT 1,
          photo_paths TEXT, -- JSON array of photo paths
          camera_ids TEXT, -- JSON array of camera IDs
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Visitor timeline table - stores individual visitor events and timeline data
      await execQuery(this.db, `
        CREATE TABLE IF NOT EXISTS visitor_timeline (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          camera_id TEXT NOT NULL,
          visitor_type TEXT NOT NULL CHECK (visitor_type IN ('known', 'unknown')),
          visitor_id TEXT,
          visitor_name TEXT,
          first_seen TIMESTAMP NOT NULL,
          last_seen TIMESTAMP NOT NULL,
          duration_minutes INTEGER DEFAULT 0,
          confidence REAL DEFAULT 0.0,
          visit_count INTEGER DEFAULT 1,
          photo_paths TEXT, -- JSON array of photo paths
          camera_ids TEXT, -- JSON array of camera IDs
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create indexes
      await execQuery(this.db, `
        CREATE INDEX IF NOT EXISTS idx_visitor_reports_type_period ON visitor_reports(report_type, period_start DESC);
        CREATE INDEX IF NOT EXISTS idx_visitor_schedules_enabled ON visitor_schedules(enabled);
        CREATE INDEX IF NOT EXISTS idx_visitor_timeline_date ON visitor_timeline(date);
        CREATE INDEX IF NOT EXISTS idx_visitor_timeline_camera ON visitor_timeline(camera_id);
        CREATE INDEX IF NOT EXISTS idx_visitor_timeline_visitor_type ON visitor_timeline(visitor_type);
        CREATE INDEX IF NOT EXISTS idx_visitor_timeline_first_seen ON visitor_timeline(first_seen);
      `);
      
      console.log('Tables created successfully');
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  // Get visitor schedules
  async getVisitorSchedules(): Promise<VisitorSchedule[]> {
    if (!this.db) {
      console.warn('Database not initialized in getVisitorSchedules, returning empty array');
      return [];
    }

    try {
      const rows = await getAllQuery(this.db, `
        SELECT * FROM visitor_schedules WHERE enabled = 1 ORDER BY created_at ASC
      `);

      return rows.map((row: any) => ({
        id: row.id,
        reportType: row.report_type,
        cronExpression: row.cron_expression,
        recipients: JSON.parse(row.recipients),
        enabled: Boolean(row.enabled),
        createdAt: row.created_at
      }));
    } catch (error) {
      console.error('Error getting visitor schedules:', error);
      return [];
    }
  }

  // Save visitor schedule
  async saveVisitorSchedule(schedule: Omit<VisitorSchedule, 'createdAt' | 'id'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await runQuery(this.db, `
      INSERT INTO visitor_schedules (
        id, report_type, cron_expression, recipients, enabled
      ) VALUES (?, ?, ?, ?, ?)
    `, [
      id,
      schedule.reportType,
      schedule.cronExpression,
      JSON.stringify(schedule.recipients),
      schedule.enabled ? 1 : 0
    ]);

    return id;
  }

  // Save visitor report
  async saveVisitorReport(report: Omit<VisitorReport, 'createdAt'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await runQuery(this.db, `
      INSERT INTO visitor_reports (
        id, report_type, period_start, period_end, total_visits, 
        unique_visitors, known_visitors, unknown_visitors, report_data, file_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  // Get real visitor timeline from actual detection files
  // Get visitor timeline from database instead of file system
  async getVisitorTimeline(startDate: Date, endDate: Date): Promise<VisitorTimeline[]> {
    return this.getVisitorTimelineFromDatabase(startDate, endDate);
  }

  // Collect all detection events for a specific day
  private async collectDetectionEventsForDay(dayStart: Date, dayEnd: Date): Promise<Array<{
    timestamp: Date;
    cameraId: string;
    type: 'face' | 'person' | 'motion';
    filePath: string;
    confidence: number;
    isKnown: boolean;
    personName?: string;
  }>> {
    const events: any[] = [];
    
    try {
      // Check if events directory exists
      if (!fs.existsSync(this.eventsDir)) {
        console.warn(`Events directory does not exist: ${this.eventsDir}`);
        return events;
      }

      // Get all detection image files
      const allFiles = await glob(path.join(this.eventsDir, '*.jpg'));
      
      console.log(`Found ${allFiles.length} image files in events directory`);
      
      // Filter files for the specific day
      for (const filePath of allFiles) {
        try {
          const filename = path.basename(filePath);
          const timestamp = this.extractTimestampFromFilename(filename);
          
          if (timestamp && timestamp >= dayStart && timestamp <= dayEnd) {
            const cameraId = this.extractCameraIdFromFilename(filename);
            
            // For now, create a basic event without facial recognition to avoid complexity
            events.push({
              timestamp,
              cameraId,
              type: this.getDetectionType(filename),
              filePath: `/events/${filename}`,
              confidence: 0.8,
              isKnown: false,
              personName: undefined
            });
          }
        } catch (fileError) {
          console.warn(`Error processing file ${filePath}:`, fileError);
        }
      }
      
    } catch (error) {
      console.error(`Error collecting events for day ${dayStart.toISOString()}:`, error);
    }
    
    return events;
  }

  // Extract timestamp from filename
  private extractTimestampFromFilename(filename: string): Date | null {
    try {
      // Try Unix timestamp first (faces_*.jpg format)
      const unixMatch = filename.match(/_(\d{13})\./);
      if (unixMatch) {
        return new Date(parseInt(unixMatch[1]));
      }
      
      // Try ISO format with hyphens (snapshot_*.jpg format)
      const isoMatch = filename.match(/_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
      if (isoMatch) {
        const isoStr = isoMatch[1].replace(/-(\d{2})-(\d{2})-(\d{2})/g, ':$1:$2:$3');
        return new Date(isoStr);
      }
      
      // Try motion format (motion_*.jpg)
      const motionMatch = filename.match(/_(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/);
      if (motionMatch) {
        return new Date(`${motionMatch[1]}T${motionMatch[2]}:${motionMatch[3]}:${motionMatch[4]}`);
      }
      
      // Fallback: use file modification time
      const filePath = path.join(this.eventsDir, filename);
      if (fs.existsSync(filePath)) {
        return fs.statSync(filePath).mtime;
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to extract timestamp from filename: ${filename}`, error);
      return null;
    }
  }

  // Extract camera ID from filename
  private extractCameraIdFromFilename(filename: string): string {
    const cameraMatch = filename.match(/(cam\d+)/);
    return cameraMatch ? cameraMatch[1] : 'unknown';
  }

  // Determine detection type from filename
  private getDetectionType(filename: string): 'face' | 'person' | 'motion' {
    if (filename.startsWith('faces_')) return 'face';
    if (filename.startsWith('person_')) return 'person';
    return 'motion';
  }

  // Process events into individual visitors
  private async processEventsToVisitors(events: Array<any>, dateStr: string): Promise<Visitor[]> {
    const visitors: Visitor[] = [];
    const visitorMap = new Map<string, any>();
    
    // Group events by visitor (face ID for known persons, time proximity for unknown)
    for (const event of events) {
      let visitorId: string;
      
      if (event.type === 'face' && event.isKnown && event.personName) {
        // Known person - use their name as identifier
        visitorId = `known_${event.personName.replace(/\s+/g, '_').toLowerCase()}`;
      } else {
        // Unknown person - group by time and camera proximity
        visitorId = `unknown_${event.cameraId}_${Math.floor(event.timestamp.getTime() / (5 * 60 * 1000))}`; // 5-minute buckets
      }
      
      if (!visitorMap.has(visitorId)) {
        visitorMap.set(visitorId, {
          id: visitorId,
          name: event.personName,
          type: event.isKnown ? 'known' : 'unknown',
          firstSeen: event.timestamp,
          lastSeen: event.timestamp,
          duration: 0,
          cameraIds: new Set([event.cameraId]),
          photos: [event.filePath],
          confidence: event.confidence,
          visitCount: 1,
          lastSeenTimestamp: event.timestamp.getTime(),
          events: [event]
        });
      } else {
        const visitor = visitorMap.get(visitorId);
        visitor.lastSeen = event.timestamp;
        visitor.lastSeenTimestamp = event.timestamp.getTime();
        visitor.cameraIds.add(event.cameraId);
        visitor.photos.push(event.filePath);
        visitor.confidence = Math.max(visitor.confidence, event.confidence);
        visitor.visitCount += 1;
        visitor.events.push(event);
      }
    }
    
    // Convert Map to Visitor objects
    for (const [visitorId, visitorData] of visitorMap.entries()) {
      // Calculate duration (time between first and last detection)
      const duration = Math.round((visitorData.lastSeen.getTime() - visitorData.firstSeen.getTime()) / (1000 * 60));
      
      visitors.push({
        id: visitorId,
        name: visitorData.name,
        type: visitorData.type,
        firstSeen: visitorData.firstSeen,
        lastSeen: visitorData.lastSeen,
        duration: Math.max(duration, 1), // At least 1 minute
        cameraIds: Array.from(visitorData.cameraIds),
        photos: [...new Set(visitorData.photos as string[])], // Remove duplicates
        confidence: visitorData.confidence,
        visitCount: visitorData.visitCount,
        lastSeenTimestamp: visitorData.lastSeenTimestamp
      });
    }
    
    return visitors.sort((a, b) => b.lastSeenTimestamp - a.lastSeenTimestamp);
  }

  // Generate daily summary statistics
  private async generateDaySummary(events: any[], visitors: Visitor[]): Promise<{
    totalVisitors: number;
    knownVisitors: number;
    unknownVisitors: number;
    totalDuration: number;
    averageVisitDuration: number;
    peakHours: Array<{ hour: number; count: number }>;
    cameras: Array<{ cameraId: string; count: number }>;
  }> {
    // Count visitors by type
    const knownVisitors = visitors.filter(v => v.type === 'known').length;
    const unknownVisitors = visitors.filter(v => v.type === 'unknown').length;
    
    // Calculate durations
    const totalDuration = visitors.reduce((sum, v) => sum + v.duration, 0);
    const averageVisitDuration = visitors.length > 0 ? Math.round(totalDuration / visitors.length) : 0;
    
    // Generate peak hours
    const hourCounts = new Map<number, number>();
    for (const event of events) {
      const hour = event.timestamp.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }
    
    const peakHours = Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);
    
    // Generate camera distribution
    const cameraCounts = new Map<string, number>();
    for (const visitor of visitors) {
      for (const cameraId of visitor.cameraIds) {
        cameraCounts.set(cameraId, (cameraCounts.get(cameraId) || 0) + 1);
      }
    }
    
    const cameras = Array.from(cameraCounts.entries())
      .map(([cameraId, count]) => ({ cameraId, count }))
      .sort((a, b) => b.count - a.count);
    
    return {
      totalVisitors: visitors.length,
      knownVisitors,
      unknownVisitors,
      totalDuration,
      averageVisitDuration,
      peakHours,
      cameras
    };
  }

  // Store visitor timeline data from detection events
  async storeVisitorTimeline(visitors: Visitor[], date: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Begin transaction for better performance
      await execQuery(this.db, 'BEGIN TRANSACTION');

      for (const visitor of visitors) {
        const id = `vt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await runQuery(this.db, `
          INSERT INTO visitor_timeline (
            id, date, camera_id, visitor_type, visitor_id, visitor_name,
            first_seen, last_seen, duration_minutes, confidence, visit_count, photo_paths, camera_ids
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          date,
          visitor.cameraIds[0] || 'unknown', // Using first camera as primary
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

      await execQuery(this.db, 'COMMIT');
    } catch (error) {
      console.error('Error storing visitor timeline:', error);
      await execQuery(this.db, 'ROLLBACK');
      throw error;
    }
  }

  // Get visitor timeline data from database
  // Internal method to get visitor timeline from database
  private async getVisitorTimelineFromDatabase(startDate: Date, endDate: Date): Promise<VisitorTimeline[]> {
    if (!this.db) {
      console.warn('Database not initialized in getVisitorTimeline, returning empty array');
      return [];
    }

    try {
      console.log(`Fetching visitor timeline from database from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Query visitor data from the database
      const rows = await getAllQuery(this.db, `
        SELECT * FROM visitor_timeline 
        WHERE date BETWEEN ? AND ?
        ORDER BY first_seen DESC
      `, [
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      ]);

      // Group data by date and convert to timeline format
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

      // Convert map to array and calculate summaries
      const timeline: VisitorTimeline[] = Array.from(timelineMap.values());

      for (const day of timeline) {
        // Calculate summary statistics for this day
        day.summary.totalVisitors = day.visitors.length;
        day.summary.knownVisitors = day.visitors.filter(v => v.type === 'known').length;
        day.summary.unknownVisitors = day.visitors.filter(v => v.type === 'unknown').length;
        day.summary.totalDuration = day.visitors.reduce((sum, v) => sum + v.duration, 0);
        day.summary.averageVisitDuration = day.visitors.length > 0 
          ? day.summary.totalDuration / day.visitors.length 
          : 0;

        // Calculate peak hours
        const hourCounts = new Map<number, number>();
        for (const visitor of day.visitors) {
          const hour = new Date(visitor.firstSeen).getHours();
          hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        }
        day.summary.peakHours = Array.from(hourCounts.entries())
          .map(([hour, count]) => ({ hour, count }))
          .sort((a, b) => b.count - a.count);

        // Calculate camera distribution
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

      console.log(`Retrieved visitor timeline with ${timeline.length} days of data from database`);
      
      return timeline;
    } catch (error) {
      console.error('Error getting visitor timeline from database:', error);
      return [];
    }
  }

  // Migrate file-based visitor data to database (should be run once during startup)
  async migrateFileDataToDatabase(startDate?: Date, endDate?: Date): Promise<void> {
    if (!this.db) {
      console.warn('Database not initialized in migrateFileDataToDatabase');
      return;
    }

    try {
      // Default to last 30 days if no dates provided
      const end = endDate || new Date();
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
      
      console.log(`Migrating visitor data from files to database from ${start.toISOString()} to ${end.toISOString()}`);
      
      // Process each day in the range
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      for (let day = 0; day <= daysDiff; day++) {
        const date = new Date(start.getTime() + day * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        
        // Check if data already exists for this date in the database
        const existingData = await getAllQuery(this.db, `
          SELECT COUNT(*) as count FROM visitor_timeline WHERE date = ?
        `, [dateStr]);
        
        if (existingData[0].count === 0) {
          console.log(`Processing data for date: ${dateStr}`);
          
          // Set start and end of day
          const dayStart = new Date(date);
          dayStart.setHours(0, 0, 0, 0);
          
          const dayEnd = new Date(date);
          dayEnd.setHours(23, 59, 59, 999);
          
          // Collect all detection events for this day
          const dayEvents = await this.collectDetectionEventsForDay(dayStart, dayEnd);
          
          if (dayEvents.length > 0) {
            // Process events into visitors
            const visitors = await this.processEventsToVisitors(dayEvents, dateStr);
            
            // Store visitors to database
            await this.storeVisitorTimeline(visitors, dateStr);
          }
        }
      }
      
      console.log('Migration completed successfully');
    } catch (error) {
      console.error('Error migrating file data to database:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        this.db!.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      this.db = null;
    }
  }
}

export const visitorDatabase = new VisitorDatabase();