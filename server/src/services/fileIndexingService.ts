import { Pool } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';

export interface DetectionFileRecord {
  fileUuid?: string;
  fileType: 'event_face' | 'event_motion' | 'snapshot' | 'batch_result' | 'temp';
  cameraId?: string;
  originalFilename: string;
  storagePath: string;
  fileSize: number;
  fileHash: string;
  captureTimestamp?: Date;
  metadata?: Record<string, any>;
}

export interface FileQueryFilters {
  fileType?: string;
  cameraId?: string;
  startDate?: Date;
  endDate?: Date;
  isArchived?: boolean;
  isDeleted?: boolean;
}

export interface StorageStats {
  file_type: string;
  file_count: number;
  total_size: number;
}

export interface StorageMetrics {
  totalFiles: number;
  totalSize: number;
  byType: Record<string, { count: number; size: number }>;
  byCamera: Record<string, { count: number; size: number }>;
}

export class FileIndexingService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async indexFile(record: DetectionFileRecord): Promise<string> {
    const query = `
      INSERT INTO detection_files (
        file_uuid,
        file_type,
        camera_id,
        original_filename,
        storage_path,
        file_size,
        file_hash,
        capture_timestamp,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (file_uuid)
      DO UPDATE SET
        storage_path = EXCLUDED.storage_path,
        file_size = EXCLUDED.file_size,
        file_hash = EXCLUDED.file_hash,
        capture_timestamp = EXCLUDED.capture_timestamp,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING file_uuid
    `;

    const fileUuid = record.fileUuid || this.generateUUID();
    const values = [
      fileUuid,
      record.fileType,
      record.cameraId || null,
      record.originalFilename,
      record.storagePath,
      record.fileSize,
      record.fileHash,
      record.captureTimestamp || null,
      record.metadata || {}
    ];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0].file_uuid;
    } catch (error) {
      console.error('Error indexing file:', error);
      throw error;
    }
  }

  async getFileMetadata(fileUuid: string): Promise<DetectionFileRecord | null> {
    const query = `
      SELECT
        file_uuid,
        file_type,
        camera_id,
        original_filename,
        storage_path,
        file_size,
        file_hash,
        capture_timestamp,
        created_at,
        updated_at,
        is_archived,
        is_deleted,
        metadata
      FROM detection_files
      WHERE file_uuid = $1
    `;

    try {
      const result = await this.pool.query(query, [fileUuid]);
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        fileUuid: row.file_uuid,
        fileType: row.file_type,
        cameraId: row.camera_id,
        originalFilename: row.original_filename,
        storagePath: row.storage_path,
        fileSize: row.file_size,
        fileHash: row.file_hash,
        captureTimestamp: row.capture_timestamp,
        metadata: row.metadata
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  async getFileByStoragePath(storagePath: string): Promise<DetectionFileRecord | null> {
    const query = `
      SELECT
        file_uuid,
        file_type,
        camera_id,
        original_filename,
        storage_path,
        file_size,
        file_hash,
        capture_timestamp,
        created_at,
        updated_at,
        is_archived,
        is_deleted,
        metadata
      FROM detection_files
      WHERE storage_path = $1
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query, [storagePath]);
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        fileUuid: row.file_uuid,
        fileType: row.file_type,
        cameraId: row.camera_id,
        originalFilename: row.original_filename,
        storagePath: row.storage_path,
        fileSize: row.file_size,
        fileHash: row.file_hash,
        captureTimestamp: row.capture_timestamp,
        metadata: row.metadata
      };
    } catch (error) {
      console.error('Error getting file by storage path:', error);
      throw error;
    }
  }

  async queryFiles(filters: FileQueryFilters): Promise<DetectionFileRecord[]> {
    const conditions: string[] = ['is_deleted = FALSE'];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.fileType) {
      conditions.push(`file_type = $${paramIndex++}`);
      values.push(filters.fileType);
    }

    if (filters.cameraId) {
      conditions.push(`camera_id = $${paramIndex++}`);
      values.push(filters.cameraId);
    }

    if (filters.startDate) {
      conditions.push(`capture_timestamp >= $${paramIndex++}`);
      values.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push(`capture_timestamp <= $${paramIndex++}`);
      values.push(filters.endDate);
    }

    if (filters.isArchived !== undefined) {
      conditions.push(`is_archived = $${paramIndex++}`);
      values.push(filters.isArchived);
    }

    if (filters.isDeleted !== undefined) {
      conditions.push(`is_deleted = $${paramIndex++}`);
      values.push(filters.isDeleted);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT
        file_uuid,
        file_type,
        camera_id,
        original_filename,
        storage_path,
        file_size,
        file_hash,
        capture_timestamp,
        created_at,
        updated_at,
        is_archived,
        is_deleted,
        metadata
      FROM detection_files
      ${whereClause}
      ORDER BY capture_timestamp DESC
    `;

    try {
      const result = await this.pool.query(query, values);
      return result.rows.map(row => ({
        fileUuid: row.file_uuid,
        fileType: row.file_type,
        cameraId: row.camera_id,
        originalFilename: row.original_filename,
        storagePath: row.storage_path,
        fileSize: row.file_size,
        fileHash: row.file_hash,
        captureTimestamp: row.capture_timestamp,
        metadata: row.metadata
      }));
    } catch (error) {
      console.error('Error querying files:', error);
      throw error;
    }
  }

  async searchFiles(searchTerm: string, filters?: FileQueryFilters): Promise<DetectionFileRecord[]> {
    const conditions: string[] = ['is_deleted = FALSE'];
    const values: any[] = [];
    let paramIndex = 1;

    conditions.push(`(original_filename ILIKE $${paramIndex++} OR camera_id ILIKE $${paramIndex++})`);
    values.push(`%${searchTerm}%`, `%${searchTerm}%`);

    if (filters?.fileType) {
      conditions.push(`file_type = $${paramIndex++}`);
      values.push(filters.fileType);
    }

    if (filters?.startDate) {
      conditions.push(`capture_timestamp >= $${paramIndex++}`);
      values.push(filters.startDate);
    }

    if (filters?.endDate) {
      conditions.push(`capture_timestamp <= $${paramIndex++}`);
      values.push(filters.endDate);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const query = `
      SELECT
        file_uuid,
        file_type,
        camera_id,
        original_filename,
        storage_path,
        file_size,
        file_hash,
        capture_timestamp,
        created_at,
        updated_at,
        is_archived,
        is_deleted,
        metadata
      FROM detection_files
      ${whereClause}
      ORDER BY capture_timestamp DESC
      LIMIT 1000
    `;

    try {
      const result = await this.pool.query(query, values);
      return result.rows.map(row => ({
        fileUuid: row.file_uuid,
        fileType: row.file_type,
        cameraId: row.camera_id,
        originalFilename: row.original_filename,
        storagePath: row.storage_path,
        fileSize: row.file_size,
        fileHash: row.file_hash,
        captureTimestamp: row.capture_timestamp,
        metadata: row.metadata
      }));
    } catch (error) {
      console.error('Error searching files:', error);
      throw error;
    }
  }

  async markAsDeleted(fileUuid: string): Promise<boolean> {
    const query = `
      UPDATE detection_files
      SET is_deleted = TRUE, updated_at = NOW()
      WHERE file_uuid = $1
      RETURNING file_uuid
    `;

    try {
      const result = await this.pool.query(query, [fileUuid]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error marking file as deleted:', error);
      throw error;
    }
  }

  async markAsArchived(fileUuid: string): Promise<boolean> {
    const query = `
      UPDATE detection_files
      SET is_archived = TRUE, updated_at = NOW()
      WHERE file_uuid = $1
      RETURNING file_uuid
    `;

    try {
      const result = await this.pool.query(query, [fileUuid]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error marking file as archived:', error);
      throw error;
    }
  }

  async archiveOldFiles(daysOld: number = 30): Promise<number> {
    const query = `
      UPDATE detection_files
      SET is_archived = TRUE, updated_at = NOW()
      WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
        AND is_archived = FALSE
        AND is_deleted = FALSE
      RETURNING file_uuid
    `;

    try {
      const result = await this.pool.query(query, [daysOld]);
      return result.rows.length;
    } catch (error) {
      console.error('Error archiving old files:', error);
      throw error;
    }
  }

  async getFilesForArchive(daysOld: number = 30): Promise<DetectionFileRecord[]> {
    const query = `
      SELECT
        file_uuid,
        file_type,
        camera_id,
        original_filename,
        storage_path,
        file_size,
        capture_timestamp
      FROM detection_files
      WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
        AND is_archived = FALSE
        AND is_deleted = FALSE
      ORDER BY created_at
      LIMIT 1000
    `;

    try {
      const result = await this.pool.query(query, [daysOld]);
      return result.rows.map(row => ({
        fileUuid: row.file_uuid,
        fileType: row.file_type,
        cameraId: row.camera_id,
        originalFilename: row.original_filename,
        storagePath: row.storage_path,
        fileSize: row.file_size,
        fileHash: '',
        captureTimestamp: row.capture_timestamp
      }));
    } catch (error) {
      console.error('Error getting files for archive:', error);
      throw error;
    }
  }

  async calculateFileHash(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      console.error('Error calculating file hash:', error);
      throw error;
    }
  }

  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      console.error('Error getting file size:', error);
      throw error;
    }
  }

  async getStorageStats(): Promise<StorageStats[]> {
    const query = `
      SELECT
        file_type,
        COUNT(*) as file_count,
        SUM(file_size) as total_size
      FROM detection_files
      WHERE is_deleted = FALSE
      GROUP BY file_type
      ORDER BY file_type
    `;

    try {
      const result = await this.pool.query(query);
      return result.rows.map(row => ({
        file_type: row.file_type,
        file_count: parseInt(row.file_count),
        total_size: parseInt(row.total_size)
      }));
    } catch (error) {
      console.error('Error getting storage stats:', error);
      throw error;
    }
  }

  async getDetailedStorageMetrics(): Promise<StorageMetrics> {
    const query = `
      SELECT
        COUNT(*) as total_files,
        SUM(file_size) as total_size,
        file_type,
        camera_id
      FROM detection_files
      WHERE is_deleted = FALSE
      GROUP BY file_type, camera_id
    `;

    try {
      const result = await this.pool.query(query);
      const metrics: StorageMetrics = {
        totalFiles: 0,
        totalSize: 0,
        byType: {},
        byCamera: {}
      };

      for (const row of result.rows) {
        const count = parseInt(row.total_files);
        const size = parseInt(row.sum);
        metrics.totalFiles += count;
        metrics.totalSize += size;

        if (!metrics.byType[row.file_type]) {
          metrics.byType[row.file_type] = { count: 0, size: 0 };
        }
        metrics.byType[row.file_type].count += count;
        metrics.byType[row.file_type].size += size;

        if (row.camera_id) {
          if (!metrics.byCamera[row.camera_id]) {
            metrics.byCamera[row.camera_id] = { count: 0, size: 0 };
          }
          metrics.byCamera[row.camera_id].count += count;
          metrics.byCamera[row.camera_id].size += size;
        }
      }

      return metrics;
    } catch (error) {
      console.error('Error getting detailed storage metrics:', error);
      throw error;
    }
  }

  async deleteOldFiles(daysOld: number = 90): Promise<number> {
    const query = `
      DELETE FROM detection_files
      WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
        AND is_deleted = TRUE
      RETURNING file_uuid
    `;

    try {
      const result = await this.pool.query(query, [daysOld]);
      return result.rows.length;
    } catch (error) {
      console.error('Error deleting old files:', error);
      throw error;
    }
  }

  private generateUUID(): string {
    return randomUUID();
  }

  async cleanupOrphanedRecords(detectionsDir: string): Promise<number> {
    const query = `
      UPDATE detection_files
      SET is_deleted = TRUE, updated_at = NOW()
      WHERE file_uuid IN (
        SELECT file_uuid FROM detection_files
        WHERE is_deleted = FALSE
      )
      AND NOT EXISTS (
        SELECT 1 FROM detection_files df
        WHERE df.storage_path = $1 || '%' LIMIT 1
      )
      RETURNING file_uuid
    `;

    try {
      const result = await this.pool.query(query, [detectionsDir]);
      return result.rows.length;
    } catch (error) {
      console.error('Error cleaning up orphaned records:', error);
      throw error;
    }
  }
}

export default FileIndexingService;
