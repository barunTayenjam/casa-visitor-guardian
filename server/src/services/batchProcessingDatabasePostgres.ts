import { logger } from '../utils/logger.js';
import { AppDataSource } from '../database.js';
import { Repository, DataSource } from 'typeorm';

export interface BatchJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  start_time?: Date;
  end_time?: Date;
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
  created_at: Date;
  updated_at: Date;
}

export interface ProcessedImage {
  id: string;
  job_id: string;
  filename: string;
  file_path: string;
  camera_id: string;
  image_timestamp: Date;
  file_size: number;
  processed_at: Date;
  person_count: number;
  face_count: number;
  known_face_count: number;
  unknown_face_count: number;
  processing_time_ms: number;
  status: 'success' | 'failed';
  error_message?: string;
  detection_json: string;
  file_hash: string;
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

// TypeORM Entity for batch_jobs
const batchJobEntity = {
  tableName: 'batch_jobs',
  columns: {
    id: { type: 'text', primary: true },
    status: { type: 'text' },
    start_time: { type: 'timestamp', nullable: true },
    end_time: { type: 'timestamp', nullable: true },
    total_images: { type: 'integer', default: 0 },
    processed_images: { type: 'integer', default: 0 },
    successful_images: { type: 'integer', default: 0 },
    failed_images: { type: 'integer', default: 0 },
    person_detections: { type: 'integer', default: 0 },
    face_detections: { type: 'integer', default: 0 },
    known_faces: { type: 'integer', default: 0 },
    unknown_faces: { type: 'integer', default: 0 },
    processing_time_ms: { type: 'integer', nullable: true },
    options_json: { type: 'jsonb' },
    error_message: { type: 'text', nullable: true },
    created_at: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }
  }
};

// TypeORM Entity for processed_images
const processedImageEntity = {
  tableName: 'processed_images',
  columns: {
    id: { type: 'text', primary: true },
    job_id: { type: 'text' },
    filename: { type: 'text' },
    file_path: { type: 'text' },
    camera_id: { type: 'text' },
    image_timestamp: { type: 'timestamp' },
    file_size: { type: 'bigint' },
    processed_at: { type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' },
    person_count: { type: 'integer', default: 0 },
    face_count: { type: 'integer', default: 0 },
    known_face_count: { type: 'integer', default: 0 },
    unknown_face_count: { type: 'integer', default: 0 },
    processing_time_ms: { type: 'integer' },
    status: { type: 'text' },
    error_message: { type: 'text', nullable: true },
    detection_json: { type: 'jsonb', default: {} },
    file_hash: { type: 'text' }
  }
};

export class BatchProcessingDatabasePostgres {
  private dataSource: DataSource;
  private isInitialized: boolean = false;

  constructor(dataSource: DataSource = AppDataSource) {
    this.dataSource = dataSource;
  }

  // Public method to initialize the database
  public async initialize(): Promise<void> {
    await this.ensureInitialized();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }
      this.isInitialized = true;
      logger.info('Batch processing PostgreSQL database initialized', 'BatchWorker');
    }
  }

  // Job management methods
  async createJob(jobData: Omit<BatchJob, 'created_at' | 'updated_at'>): Promise<string> {
    await this.ensureInitialized();

    const now = new Date().toISOString();
    const query = `
      INSERT INTO batch_jobs (
        id, status, start_time, end_time, total_images, processed_images,
        successful_images, failed_images, person_detections, face_detections,
        known_faces, unknown_faces, processing_time_ms, options_json,
        error_message, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id
    `;

    const result = await this.dataSource.query(query, [
      jobData.id,
      jobData.status,
      jobData.start_time?.toISOString() || null,
      jobData.end_time?.toISOString() || null,
      jobData.total_images,
      jobData.processed_images,
      jobData.successful_images,
      jobData.failed_images,
      jobData.person_detections,
      jobData.face_detections,
      jobData.known_faces,
      jobData.unknown_faces,
      jobData.processing_time_ms || null,
      typeof jobData.options_json === 'string' ? jobData.options_json : JSON.stringify(jobData.options_json),
      jobData.error_message || null,
      now,
      now
    ]);

    return result[0]?.id || jobData.id;
  }

  async updateJob(jobId: string, updates: Partial<Omit<BatchJob, 'id' | 'created_at'>>): Promise<boolean> {
    await this.ensureInitialized();
    
    const now = new Date().toISOString();
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        if (key === 'options_json' && typeof value === 'object') {
          values.push(JSON.stringify(value));
        } else if (value instanceof Date) {
          values.push(value.toISOString());
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) return false;

    fields.push(`updated_at = $${paramIndex}`);
    values.push(now);
    paramIndex++;
    values.push(jobId);

    const query = `UPDATE batch_jobs SET ${fields.join(', ')} WHERE id = $${paramIndex}`;
    const result = await this.dataSource.query(query, values);
    
    return (result.rowCount || 0) > 0;
  }

  async getJob(jobId: string): Promise<BatchJob | null> {
    await this.ensureInitialized();
    
    const query = 'SELECT * FROM batch_jobs WHERE id = $1';
    const result = await this.dataSource.query(query, [jobId]);
    
    if (result.length === 0) return null;
    return result[0] as BatchJob;
  }

  async getJobs(options: {
    status?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'created_at' | 'updated_at' | 'start_time';
    orderDirection?: 'ASC' | 'DESC';
  } = {}): Promise<BatchJob[]> {
    await this.ensureInitialized();
    
    let query = 'SELECT * FROM batch_jobs';
    const params: any[] = [];
    let paramIndex = 1;

    if (options.status) {
      query += ` WHERE status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    const orderBy = options.orderBy || 'created_at';
    const orderDirection = options.orderDirection || 'DESC';
    query += ` ORDER BY ${orderBy} ${orderDirection}`;

    if (options.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
      paramIndex++;

      if (options.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(options.offset);
        paramIndex++;
      }
    }

    return await this.dataSource.query(query, params) as BatchJob[];
  }

  async deleteJob(jobId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const query = 'DELETE FROM batch_jobs WHERE id = $1';
    const result = await this.dataSource.query(query, [jobId]);
    
    return (result.rowCount || 0) > 0;
  }

  // Processed image management methods
  async isImageProcessed(fileHash: string, jobId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    // Check if this exact image was processed in this specific job
    // This prevents cross-job deduplication collisions
    const query = 'SELECT COUNT(*) as count FROM processed_images WHERE file_hash = $1 AND job_id = $2';
    const result = await this.dataSource.query(query, [fileHash, jobId]);
    
    return (result[0]?.count || 0) > 0;
  }

  async addProcessedImage(imageData: Omit<ProcessedImage, 'processed_at'>, checkDuplicates: boolean = false): Promise<string> {
    await this.ensureInitialized();

    const processedAt = new Date().toISOString();
    const conflictClause = checkDuplicates ? 
      `ON CONFLICT (file_hash) DO NOTHING` : 
      `ON CONFLICT (file_hash) DO UPDATE SET 
        processed_at = EXCLUDED.processed_at, 
        status = EXCLUDED.status,
        error_message = COALESCE(processed_images.error_message, 'Skipped: duplicate in current job')`;
    
    const query = `
      INSERT INTO processed_images (
        id, job_id, filename, file_path, camera_id, image_timestamp,
        file_size, processed_at, person_count, face_count, known_face_count,
        unknown_face_count, processing_time_ms, status, error_message,
        detection_json, file_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ${conflictClause}
    `;

    await this.dataSource.query(query, [
      imageData.id,
      imageData.job_id,
      imageData.filename,
      imageData.file_path,
      imageData.image_timestamp.toISOString(),
      imageData.file_size,
      processedAt,
      imageData.person_count,
      imageData.face_count,
      imageData.known_face_count,
      imageData.unknown_face_count,
      imageData.processing_time_ms,
      imageData.status,
      imageData.error_message || null,
      typeof imageData.detection_json === 'string' 
        ? imageData.detection_json 
        : JSON.stringify(imageData.detection_json),
      imageData.file_hash
    ]);

    return imageData.id;
  }

  async getProcessedImages(jobId: string): Promise<ProcessedImage[]> {
    await this.ensureInitialized();
    
    const query = `
      SELECT * FROM processed_images 
      WHERE job_id = $1 
      ORDER BY image_timestamp DESC
    `;
    
    return await this.dataSource.query(query, [jobId]) as ProcessedImage[];
  }

  async getProcessedImageDetails(imageId: string): Promise<ProcessedImage | null> {
    await this.ensureInitialized();
    
    const query = 'SELECT * FROM processed_images WHERE id = $1';
    const result = await this.dataSource.query(query, [imageId]);
    
    if (result.length === 0) return null;
    return result[0] as ProcessedImage;
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
    await this.ensureInitialized();
    
    let query = 'SELECT * FROM processed_images WHERE status = \'success\'';
    const params: any[] = [];
    let paramIndex = 1;

    if (criteria.cameraId) {
      query += ` AND camera_id = $${paramIndex}`;
      params.push(criteria.cameraId);
      paramIndex++;
    }

    if (criteria.startDate) {
      query += ` AND image_timestamp >= $${paramIndex}`;
      params.push(criteria.startDate);
      paramIndex++;
    }

    if (criteria.endDate) {
      query += ` AND image_timestamp <= $${paramIndex}`;
      params.push(criteria.endDate);
      paramIndex++;
    }

    if (criteria.hasPersons) {
      query += ` AND person_count > 0`;
    }

    if (criteria.hasFaces) {
      query += ` AND face_count > 0`;
    }

    if (criteria.hasKnownFaces) {
      query += ` AND known_face_count > 0`;
    }

    query += ' ORDER BY image_timestamp DESC';

    if (criteria.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(criteria.limit);
      paramIndex++;

      if (criteria.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(criteria.offset);
        paramIndex++;
      }
    }

    return await this.dataSource.query(query, params) as ProcessedImage[];
  }

  // Statistics and analytics
  async getJobSummary(): Promise<BatchJobSummary> {
    await this.ensureInitialized();
    
    const statusCountsQuery = `
      SELECT status, COUNT(*) as count 
      FROM batch_jobs 
      GROUP BY status
    `;
    
    const statusCounts = await this.dataSource.query(statusCountsQuery);

    const totalsQuery = `
      SELECT 
        SUM(total_images) as total_images,
        SUM(person_detections) as total_person_detections,
        SUM(face_detections) as total_face_detections,
        SUM(known_faces) as total_known_faces,
        SUM(unknown_faces) as total_unknown_faces,
        AVG(processing_time_ms) as avg_processing_time
      FROM batch_jobs 
      WHERE status = 'completed'
    `;
    
    const totals = await this.dataSource.query(totalsQuery);

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

    if (totals.length > 0) {
      const t = totals[0];
      summary.total_images_processed = t.total_images || 0;
      summary.total_person_detections = t.total_person_detections || 0;
      summary.total_face_detections = t.total_face_detections || 0;
      summary.total_known_faces = t.total_known_faces || 0;
      summary.total_unknown_faces = t.total_unknown_faces || 0;
      summary.average_processing_time_ms = t.avg_processing_time || 0;
    }

    return summary;
  }

  async getProcessingHistory(days: number = 7): Promise<Array<{
    date: string;
    jobs_completed: number;
    images_processed: number;
    persons_detected: number;
    faces_detected: number;
    avg_processing_time_ms: number;
  }>> {
    await this.ensureInitialized();
    
    const query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as jobs_completed,
        SUM(total_images) as images_processed,
        SUM(person_detections) as persons_detected,
        SUM(face_detections) as faces_detected,
        AVG(processing_time_ms) as avg_processing_time_ms
      FROM batch_jobs 
      WHERE status = 'completed' 
        AND created_at >= NOW() - INTERVAL '1 day' * $1
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    return await this.dataSource.query(query, [days]);
  }

  // Utility methods
  async cleanupOldJobs(daysToKeep: number = 30): Promise<number> {
    await this.ensureInitialized();
    
    const query = `
      DELETE FROM batch_jobs 
      WHERE created_at < NOW() - INTERVAL '1 day' * $1 
        AND status IN ('completed', 'failed', 'cancelled')
    `;
    
    const result = await this.dataSource.query(query, [daysToKeep]);
    return result.rowCount || 0;
  }

  async getDatabaseStats(): Promise<{
    total_jobs: number;
    total_processed_images: number;
    database_size_mb: number;
  }> {
    await this.ensureInitialized();
    
    const jobCountQuery = 'SELECT COUNT(*) as count FROM batch_jobs';
    const imageCountQuery = 'SELECT COUNT(*) as count FROM processed_images';
    
    const [jobCount, imageCount] = await Promise.all([
      this.dataSource.query(jobCountQuery),
      this.dataSource.query(imageCountQuery)
    ]);

    return {
      total_jobs: jobCount[0]?.count || 0,
      total_processed_images: imageCount[0]?.count || 0,
      database_size_mb: 0 // Would need to query pg_stat_user_tables for actual size
    };
  }
}

// Singleton instance
let batchDB: BatchProcessingDatabasePostgres | null = null;

export async function getBatchProcessingDatabase(): Promise<BatchProcessingDatabasePostgres> {
  if (!batchDB) {
    batchDB = new BatchProcessingDatabasePostgres();
    await batchDB.initialize();
  }
  return batchDB;
}

export default BatchProcessingDatabasePostgres;
