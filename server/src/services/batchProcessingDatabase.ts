import { getDatabasePool } from './databasePool.js';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const DB_PATH = path.join(__dirname, '../../data/batch_processing.db');

export interface BatchJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  start_time?: string;
  end_time?: string;
  total_images: number;
  processed_images: number;
  successful_images: number;
  failed_images: number;
  person_detections: number;
  face_detections: number;
  known_faces: number;
  unknown_faces: number;
  processing_time_ms?: number;
  options_json: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ProcessedImage {
  id: string;
  job_id: string;
  filename: string;
  file_path: string;
  camera_id: string;
  image_timestamp: string;
  file_size: number;
  processed_at: string;
  person_count: number;
  face_count: number;
  known_face_count: number;
  unknown_face_count: number;
  processing_time_ms: number;
  status: 'success' | 'failed';
  error_message?: string;
  detection_json: string; // Detailed detection results
  file_hash: string; // MD5 hash for duplicate detection
}

export interface BatchJobSummary {
  total_jobs: number;
  queued_jobs: number;
  running_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  cancelled_jobs: number;
  total_images_processed: number;
  total_person_detections: number;
  total_face_detections: number;
  total_known_faces: number;
  total_unknown_faces: number;
  average_processing_time_ms: number;
}

export class BatchProcessingDatabase {
  private dbPath: string;

  constructor(dbPath: string = DB_PATH) {
    this.dbPath = dbPath;
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      const pool = await getDatabasePool(this.dbPath);
      
      console.log('Creating batch_jobs table...');
      // Create batch jobs table
      await pool.executeRun(`
        CREATE TABLE IF NOT EXISTS batch_jobs (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
          start_time TEXT,
          end_time TEXT,
          total_images INTEGER NOT NULL DEFAULT 0,
          processed_images INTEGER NOT NULL DEFAULT 0,
          successful_images INTEGER NOT NULL DEFAULT 0,
          failed_images INTEGER NOT NULL DEFAULT 0,
          person_detections INTEGER NOT NULL DEFAULT 0,
          face_detections INTEGER NOT NULL DEFAULT 0,
          known_faces INTEGER NOT NULL DEFAULT 0,
          unknown_faces INTEGER NOT NULL DEFAULT 0,
          processing_time_ms INTEGER,
          options_json TEXT NOT NULL,
          error_message TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      console.log('Creating processed_images table...');
      // Create processed images table
      await pool.executeRun(`
        CREATE TABLE IF NOT EXISTS processed_images (
          id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          filename TEXT NOT NULL,
          file_path TEXT NOT NULL,
          camera_id TEXT NOT NULL,
          image_timestamp TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          processed_at TEXT NOT NULL DEFAULT (datetime('now')),
          person_count INTEGER NOT NULL DEFAULT 0,
          face_count INTEGER NOT NULL DEFAULT 0,
          known_face_count INTEGER NOT NULL DEFAULT 0,
          unknown_face_count INTEGER NOT NULL DEFAULT 0,
          processing_time_ms INTEGER NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
          error_message TEXT,
          detection_json TEXT NOT NULL DEFAULT '{}',
          file_hash TEXT NOT NULL,
          FOREIGN KEY (job_id) REFERENCES batch_jobs (id) ON DELETE CASCADE
        )
      `);

      console.log('Creating indexes...');
      // Create indexes for performance
      await pool.executeRun('CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status)');
      await pool.executeRun('CREATE INDEX IF NOT EXISTS idx_batch_jobs_created_at ON batch_jobs(created_at DESC)');
      await pool.executeRun('CREATE INDEX IF NOT EXISTS idx_processed_images_job_id ON processed_images(job_id)');
      await pool.executeRun('CREATE INDEX IF NOT EXISTS idx_processed_images_filename ON processed_images(filename)');
      await pool.executeRun('CREATE INDEX IF NOT EXISTS idx_processed_images_camera_id ON processed_images(camera_id)');
      await pool.executeRun('CREATE INDEX IF NOT EXISTS idx_processed_images_processed_at ON processed_images(processed_at DESC)');
      await pool.executeRun('CREATE INDEX IF NOT EXISTS idx_processed_images_file_hash ON processed_images(file_hash)');

      console.log('Creating unique index on file_hash...');
      // Create unique index on file_hash for duplicate detection
      try {
        await pool.executeRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_images_file_hash_unique ON processed_images(file_hash)');
      } catch (error) {
        console.warn('Could not create unique index on file_hash (may already exist):', error);
      }

      console.log('Batch processing database initialized successfully');
    } catch (error) {
      console.error('Error initializing batch processing database:', error);
      throw error;
    }
  }

  // Job management methods
  async createJob(jobData: Omit<BatchJob, 'created_at' | 'updated_at'>): Promise<string> {
    const pool = await getDatabasePool(this.dbPath);
    const now = new Date().toISOString();
    
    const result = await pool.executeRun(`
      INSERT INTO batch_jobs (
        id, status, start_time, end_time, total_images, processed_images,
        successful_images, failed_images, person_detections, face_detections,
        known_faces, unknown_faces, processing_time_ms, options_json,
        error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      jobData.id,
      jobData.status,
      jobData.start_time,
      jobData.end_time,
      jobData.total_images,
      jobData.processed_images,
      jobData.successful_images,
      jobData.failed_images,
      jobData.person_detections,
      jobData.face_detections,
      jobData.known_faces,
      jobData.unknown_faces,
      jobData.processing_time_ms,
      jobData.options_json,
      jobData.error_message,
      now,
      now
    ]);

    return jobData.id;
  }

  async updateJob(jobId: string, updates: Partial<Omit<BatchJob, 'id' | 'created_at'>>): Promise<boolean> {
    const pool = await getDatabasePool(this.dbPath);
    const now = new Date().toISOString();
    
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (fields.length === 0) return false;
    
    fields.push('updated_at = ?');
    values.push(now);
    values.push(jobId);
    
    const result = await pool.executeRun(
      `UPDATE batch_jobs SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    return result.changes > 0;
  }

  async getJob(jobId: string): Promise<BatchJob | null> {
    const pool = await getDatabasePool(this.dbPath);
    return await pool.executeOne<BatchJob>('SELECT * FROM batch_jobs WHERE id = ?', [jobId]);
  }

  async getJobs(options: {
    status?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'created_at' | 'updated_at' | 'start_time';
    orderDirection?: 'ASC' | 'DESC';
  } = {}): Promise<BatchJob[]> {
    const pool = await getDatabasePool(this.dbPath);
    
    let query = 'SELECT * FROM batch_jobs';
    const params: any[] = [];
    
    if (options.status) {
      query += ' WHERE status = ?';
      params.push(options.status);
    }
    
    const orderBy = options.orderBy || 'created_at';
    const orderDirection = options.orderDirection || 'DESC';
    query += ` ORDER BY ${orderBy} ${orderDirection}`;
    
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
      
      if (options.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }
    }
    
    return await pool.execute<BatchJob>(query, params);
  }

  async deleteJob(jobId: string): Promise<boolean> {
    const pool = await getDatabasePool(this.dbPath);
    const result = await pool.executeRun('DELETE FROM batch_jobs WHERE id = ?', [jobId]);
    return result.changes > 0;
  }

  // Processed image management methods
  async isImageProcessed(fileHash: string): Promise<boolean> {
    try {
      const pool = await getDatabasePool(this.dbPath);
      const result = await pool.executeOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM processed_images WHERE file_hash = ?',
        [fileHash]
      );
      return result ? result.count > 0 : false;
    } catch (error) {
      console.error('Error checking if image is processed:', error);
      return false;
    }
  }

  async addProcessedImage(imageData: Omit<ProcessedImage, 'id' | 'processed_at'>): Promise<string> {
    try {
      const pool = await getDatabasePool(this.dbPath);
      const processedAt = new Date().toISOString();
      
      const result = await pool.executeRun(`
        INSERT OR IGNORE INTO processed_images (
          id, job_id, filename, file_path, camera_id, image_timestamp,
          file_size, processed_at, person_count, face_count, known_face_count,
          unknown_face_count, processing_time_ms, status, error_message,
          detection_json, file_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        imageData.id,
        imageData.job_id,
        imageData.filename,
        imageData.file_path,
        imageData.camera_id,
        imageData.image_timestamp,
        imageData.file_size,
        processedAt,
        imageData.person_count,
        imageData.face_count,
        imageData.known_face_count,
        imageData.unknown_face_count,
        imageData.processing_time_ms,
        imageData.status,
        imageData.error_message,
        imageData.detection_json,
        imageData.file_hash
      ]);

      return imageData.id;
    } catch (error) {
      console.error('Error adding processed image to database:', error);
      throw error;
    }
  }

  async getProcessedImages(jobId: string): Promise<ProcessedImage[]> {
    const pool = await getDatabasePool(this.dbPath);
    return await pool.execute<ProcessedImage>(
      'SELECT * FROM processed_images WHERE job_id = ? ORDER BY image_timestamp DESC',
      [jobId]
    );
  }

  async getProcessedImageDetails(imageId: string): Promise<ProcessedImage | null> {
    const pool = await getDatabasePool(this.dbPath);
    return await pool.executeOne<ProcessedImage>(
      'SELECT * FROM processed_images WHERE id = ?',
      [imageId]
    );
  }

  async searchProcessedImages(criteria: {
    cameraId?: string;
    startDate?: string;
    endDate?: string;
    hasPersons?: boolean;
    hasFaces?: boolean;
    hasKnownFaces?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ProcessedImage[]> {
    const pool = await getDatabasePool(this.dbPath);
    
    let query = 'SELECT * FROM processed_images WHERE status = "success"';
    const params: any[] = [];
    
    if (criteria.cameraId) {
      query += ' AND camera_id = ?';
      params.push(criteria.cameraId);
    }
    
    if (criteria.startDate) {
      query += ' AND image_timestamp >= ?';
      params.push(criteria.startDate);
    }
    
    if (criteria.endDate) {
      query += ' AND image_timestamp <= ?';
      params.push(criteria.endDate);
    }
    
    if (criteria.hasPersons) {
      query += ' AND person_count > 0';
    }
    
    if (criteria.hasFaces) {
      query += ' AND face_count > 0';
    }
    
    if (criteria.hasKnownFaces) {
      query += ' AND known_face_count > 0';
    }
    
    query += ' ORDER BY image_timestamp DESC';
    
    if (criteria.limit) {
      query += ' LIMIT ?';
      params.push(criteria.limit);
      
      if (criteria.offset) {
        query += ' OFFSET ?';
        params.push(criteria.offset);
      }
    }
    
    return await pool.execute<ProcessedImage>(query, params);
  }

  // Statistics and analytics
  async getJobSummary(): Promise<BatchJobSummary> {
    try {
      const pool = await getDatabasePool(this.dbPath);
      
      const statusCounts = await pool.execute<{ status: string; count: number }>(
        `SELECT status, COUNT(*) as count FROM batch_jobs GROUP BY status`
      );
      
      const totals = await pool.executeOne<{ 
        total_images: number;
        total_person_detections: number;
        total_face_detections: number;
        total_known_faces: number;
        total_unknown_faces: number;
        avg_processing_time: number;
      }>(`
        SELECT 
          SUM(total_images) as total_images,
          SUM(person_detections) as total_person_detections,
          SUM(face_detections) as total_face_detections,
          SUM(known_faces) as total_known_faces,
          SUM(unknown_faces) as total_unknown_faces,
          AVG(processing_time_ms) as avg_processing_time
        FROM batch_jobs 
        WHERE status = 'completed'
      `);
      
      const summary: BatchJobSummary = {
        total_jobs: 0,
        queued_jobs: 0,
        running_jobs: 0,
        completed_jobs: 0,
        failed_jobs: 0,
        cancelled_jobs: 0,
        total_images_processed: 0,
        total_person_detections: 0,
        total_face_detections: 0,
        total_known_faces: 0,
        total_unknown_faces: 0,
        average_processing_time_ms: 0
      };
      
      // Initialize all counts to 0
      for (const { status, count } of statusCounts) {
        switch (status) {
          case 'queued': summary.queued_jobs = count; break;
          case 'running': summary.running_jobs = count; break;
          case 'completed': summary.completed_jobs = count; break;
          case 'failed': summary.failed_jobs = count; break;
          case 'cancelled': summary.cancelled_jobs = count; break;
        }
        summary.total_jobs += count;
      }
      
      if (totals) {
        summary.total_images_processed = totals.total_images || 0;
        summary.total_person_detections = totals.total_person_detections || 0;
        summary.total_face_detections = totals.total_face_detections || 0;
        summary.total_known_faces = totals.total_known_faces || 0;
        summary.total_unknown_faces = totals.total_unknown_faces || 0;
        summary.average_processing_time_ms = totals.avg_processing_time || 0;
      }
      
      return summary;
    } catch (error) {
      console.error('Error getting job summary:', error);
      throw error;
    }
  }

  async getProcessingHistory(days: number = 7): Promise<Array<{
    date: string;
    jobs_completed: number;
    images_processed: number;
    persons_detected: number;
    faces_detected: number;
    avg_processing_time_ms: number;
  }>> {
    const pool = await getDatabasePool(this.dbPath);
    
    return await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as jobs_completed,
        SUM(total_images) as images_processed,
        SUM(person_detections) as persons_detected,
        SUM(face_detections) as faces_detected,
        AVG(processing_time_ms) as avg_processing_time_ms
      FROM batch_jobs 
      WHERE status = 'completed' 
        AND created_at >= datetime('now', '-${days} days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
  }

  // Utility methods
  async cleanupOldJobs(daysToKeep: number = 30): Promise<number> {
    const pool = await getDatabasePool(this.dbPath);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await pool.executeRun(
      'DELETE FROM batch_jobs WHERE created_at < ? AND status IN ("completed", "failed", "cancelled")',
      [cutoffDate.toISOString()]
    );
    
    return result.changes;
  }

  async getDatabaseStats(): Promise<{
    total_jobs: number;
    total_processed_images: number;
    database_size_mb: number;
  }> {
    const pool = await getDatabasePool(this.dbPath);
    
    const jobCount = await pool.executeOne<{ count: number }>('SELECT COUNT(*) as count FROM batch_jobs');
    const imageCount = await pool.executeOne<{ count: number }>('SELECT COUNT(*) as count FROM processed_images');
    
    // Get database file size
    let dbSize = 0;
    try {
      const stats = fs.statSync(this.dbPath);
      dbSize = stats.size;
    } catch (error) {
      console.warn('Could not get database size:', error);
    }
    
    return {
      total_jobs: jobCount?.count || 0,
      total_processed_images: imageCount?.count || 0,
      database_size_mb: Math.round(dbSize / (1024 * 1024) * 100) / 100
    };
  }
}

// Singleton instance
let batchDB: BatchProcessingDatabase | null = null;

export async function getBatchProcessingDatabase(): Promise<BatchProcessingDatabase> {
  if (!batchDB) {
    batchDB = new BatchProcessingDatabase();
    // Wait for initialization to complete
    await batchDB.initializeDatabase();
  }
  return batchDB;
}

export default BatchProcessingDatabase;