import path from 'node:path';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';

interface MigrationResult {
  totalFiles: number;
  movedFiles: number;
  indexedFiles: number;
  failedFiles: number;
  failedIndexing: number;
  errors: string[];
  databaseErrors: string[];
}

interface FileMetadata {
  sourcePath: string;
  destPath: string;
  fileType: 'event_face' | 'event_motion' | 'snapshot' | 'batch_result' | 'temp';
  cameraId?: string;
  originalFilename: string;
  captureTimestamp?: Date;
  fileSize: number;
  fileHash: string;
}

class StorageMigration {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async calculateFileHash(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      console.error('Error calculating hash for file:', filePath, error);
      throw error;
    }
  }

  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      console.error('Error getting size for file:', filePath, error);
      throw error;
    }
  }

  parseTimestamp(filename: string): Date | null {
    const patterns = [
      /_(\d{13})\./,
      /_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\./,
      /_(\d{13})Z\./
    ];

    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match) {
        const timestampStr = match[1];
        if (timestampStr.length === 13) {
          return new Date(parseInt(timestampStr));
        } else {
          return new Date(timestampStr);
        }
      }
    }

    return null;
  }

  parseCameraId(filename: string): string | null {
    const patterns = [
      /_(cam\d+)_/,
      /(cam\d+)_/,
      /camera([a-zA-Z0-9]+)_/
    ];

    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  determineFileType(filename: string, sourceDir: string): FileMetadata['fileType'] {
    if (sourceDir.includes('events') || sourceDir.includes('faces')) {
      if (filename.startsWith('faces') || filename.startsWith('event_face')) {
        return 'event_face';
      } else if (filename.startsWith('motion') || filename.startsWith('event_motion')) {
        return 'event_motion';
      }
    }

    if (sourceDir.includes('snapshots') || filename.startsWith('snapshot')) {
      return 'snapshot';
    }

    if (sourceDir.includes('batch') || filename.startsWith('batch')) {
      return 'batch_result';
    }

    return 'temp';
  }

  async indexFileInDatabase(metadata: FileMetadata): Promise<void> {
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
      DO NOTHING
    `;

    const fileUuid = crypto.randomUUID();
    const values = [
      fileUuid,
      metadata.fileType,
      metadata.cameraId || null,
      metadata.originalFilename,
      metadata.destPath,
      metadata.fileSize,
      metadata.fileHash,
      metadata.captureTimestamp || null,
      JSON.stringify({ source: 'migration' })
    ];

    try {
      await this.pool.query(query, values);
    } catch (error) {
      console.error('Error indexing file in database:', error);
      throw error;
    }
  }

  async migrateDirectory(
    sourceDir: string,
    baseDestDir: string,
    dryRun: boolean = false
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      totalFiles: 0,
      movedFiles: 0,
      indexedFiles: 0,
      failedFiles: 0,
      failedIndexing: 0,
      errors: [],
      databaseErrors: []
    };

    try {
      console.log(`\nMigrating directory: ${sourceDir}`);

      const files = await fs.readdir(sourceDir);
      result.totalFiles = files.length;

      console.log(`Found ${result.totalFiles} files to migrate`);

      for (const filename of files) {
        try {
          const sourcePath = path.join(sourceDir, filename);
          const stats = await fs.stat(sourcePath);

          if (!stats.isFile()) {
            continue;
          }

          const fileType = this.determineFileType(filename, sourceDir);
          const captureTimestamp = this.parseTimestamp(filename);
          const cameraId = this.parseCameraId(filename);
          const fileSize = await this.getFileSize(sourcePath);
          const fileHash = await this.calculateFileHash(sourcePath);

          const timestamp = captureTimestamp || new Date();
          const year = timestamp.getFullYear();
          const month = String(timestamp.getMonth() + 1).padStart(2, '0');
          const yearMonth = `${year}-${month}`;

          let destPath: string;
          if (fileType === 'event_face') {
            destPath = path.join(baseDestDir, yearMonth, 'events', 'faces', filename);
          } else if (fileType === 'event_motion') {
            destPath = path.join(baseDestDir, yearMonth, 'events', 'motion', filename);
          } else if (fileType === 'snapshot') {
            destPath = path.join(baseDestDir, yearMonth, 'snapshots', filename);
          } else if (fileType === 'batch_result') {
            destPath = path.join(baseDestDir, yearMonth, 'batch-results', filename);
          } else {
            destPath = path.join(baseDestDir, yearMonth, 'temp', filename);
          }

          if (!dryRun) {
            await fs.mkdir(path.dirname(destPath), { recursive: true });
            await fs.rename(sourcePath, destPath);
            result.movedFiles++;
          }

          const metadata: FileMetadata = {
            sourcePath,
            destPath,
            fileType,
            cameraId,
            originalFilename: filename,
            captureTimestamp: timestamp,
            fileSize,
            fileHash
          };

          if (!dryRun) {
            try {
              await this.indexFileInDatabase(metadata);
              result.indexedFiles++;
            } catch (error) {
              result.failedIndexing++;
              result.databaseErrors.push(`Failed to index ${filename}: ${(error as Error).message}`);
            }
          } else {
            result.indexedFiles++;
          }

          if (result.movedFiles % 100 === 0) {
            console.log(`Progress: ${result.movedFiles}/${result.totalFiles} files migrated`);
          }
        } catch (error) {
          result.failedFiles++;
          result.errors.push(`Failed to migrate ${filename}: ${(error as Error).message}`);
          console.error(`Error migrating file ${filename}:`, error);
        }
      }
    } catch (error) {
      result.errors.push(`Error processing directory ${sourceDir}: ${(error as Error).message}`);
      console.error(`Error processing directory ${sourceDir}:`, error);
    }

    return result;
  }

  async migrateAll(dryRun: boolean = false): Promise<MigrationResult> {
    const baseDestDir = path.join(process.cwd(), 'data/detections');
    const sourceDirs = [
      { source: 'server/public/events', name: 'events' },
      { source: 'server/public/snapshots', name: 'snapshots' },
      { source: 'server/public/batch-results', name: 'batch-results' },
      { source: 'server/public/motion', name: 'motion' },
      { source: 'public/events', name: 'public-events' },
      { source: 'public/snapshots', name: 'public-snapshots' }
    ];

    const finalResult: MigrationResult = {
      totalFiles: 0,
      movedFiles: 0,
      indexedFiles: 0,
      failedFiles: 0,
      failedIndexing: 0,
      errors: [],
      databaseErrors: []
    };

    console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Starting migration...`);
    console.log(`Destination directory: ${baseDestDir}`);

    for (const { source, name } of sourceDirs) {
      const sourcePath = path.join(process.cwd(), source);

      try {
        const stats = await fs.stat(sourcePath);
        if (stats.isDirectory()) {
          console.log(`\nMigrating ${name}...`);
          const result = await this.migrateDirectory(sourcePath, baseDestDir, dryRun);

          finalResult.totalFiles += result.totalFiles;
          finalResult.movedFiles += result.movedFiles;
          finalResult.indexedFiles += result.indexedFiles;
          finalResult.failedFiles += result.failedFiles;
          finalResult.failedIndexing += result.failedIndexing;
          finalResult.errors.push(...result.errors);
          finalResult.databaseErrors.push(...result.databaseErrors);
        } else {
          console.log(`Skipping ${name}: not a directory`);
        }
      } catch (error) {
        if ((error as any).code !== 'ENOENT') {
          finalResult.errors.push(`Error accessing ${source}: ${(error as Error).message}`);
        }
      }
    }

    return finalResult;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-n');

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'sentryvision',
    user: process.env.DB_USER || 'sentryvision',
    password: process.env.DB_PASSWORD
  });

  try {
    console.log('Connecting to database...');
    await pool.connect();
    console.log('Database connection established');

    const migration = new StorageMigration(pool);
    const result = await migration.migrateAll(dryRun);

    console.log('\n=== Migration Summary ===');
    console.log(`Total files: ${result.totalFiles}`);
    console.log(`Moved files: ${result.movedFiles}`);
    console.log(`Indexed files: ${result.indexedFiles}`);
    console.log(`Failed moves: ${result.failedFiles}`);
    console.log(`Failed indexing: ${result.failedIndexing}`);
    console.log(`Total errors: ${result.errors.length + result.databaseErrors.length}`);

    if (result.errors.length > 0) {
      console.log('\n=== File Migration Errors ===');
      result.errors.slice(0, 10).forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
      if (result.errors.length > 10) {
        console.log(`... and ${result.errors.length - 10} more errors`);
      }
    }

    if (result.databaseErrors.length > 0) {
      console.log('\n=== Database Indexing Errors ===');
      result.databaseErrors.slice(0, 10).forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
      if (result.databaseErrors.length > 10) {
        console.log(`... and ${result.databaseErrors.length - 10} more errors`);
      }
    }

    if (result.movedFiles > 0 && result.failedFiles === 0) {
      console.log('\n✅ Migration completed successfully!');
    } else if (result.movedFiles > 0 && result.failedFiles < result.movedFiles) {
      console.log('\n⚠️ Migration completed with some errors');
    } else {
      console.log('\n❌ Migration failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { StorageMigration, MigrationResult, FileMetadata };
