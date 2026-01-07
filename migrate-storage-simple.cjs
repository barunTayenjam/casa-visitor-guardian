#!/usr/bin/env node

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const crypto = require('crypto');

async function calculateFileHash(filePath) {
  try {
    const fileBuffer = await fsPromises.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  } catch (error) {
    return '';
  }
}

async function getFileSize(filePath) {
  try {
    const stats = await fsPromises.stat(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

function parseTimestamp(filename) {
  const patterns = [
    /_(\d{13})\./,
    /_(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\./,
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
        const date = new Date(timestampStr);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
  }

  return new Date();
}

function parseCameraId(filename) {
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

  return '';
}

function determineFileType(filename, sourceDir) {
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

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function migrateDirectory(sourceDir, baseDestDir, dryRun = false, csvStream) {
  const result = {
    totalFiles: 0,
    movedFiles: 0,
    failedFiles: 0,
    errors: []
  };

  try {
    console.log(`\nMigrating directory: ${sourceDir}`);

    const files = await fsPromises.readdir(sourceDir);
    result.totalFiles = files.length;

    console.log(`Found ${result.totalFiles} files to migrate`);

    for (const filename of files) {
      try {
        const sourcePath = path.join(sourceDir, filename);
        const stats = await fsPromises.stat(sourcePath);

        if (!stats.isFile()) {
          continue;
        }

        const fileType = determineFileType(filename, sourceDir);
        const captureTimestamp = parseTimestamp(filename);
        const cameraId = parseCameraId(filename);

        const timestamp = captureTimestamp || new Date();
        const year = timestamp.getFullYear();
        const month = String(timestamp.getMonth() + 1).padStart(2, '0');
        const yearMonth = `${year}-${month}`;

        let destPath;
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
          await fsPromises.mkdir(path.dirname(destPath), { recursive: true });
          await fsPromises.rename(sourcePath, destPath);
          result.movedFiles++;
        }

        const fileSize = await getFileSize(dryRun ? sourcePath : destPath);
        const fileHash = await calculateFileHash(dryRun ? sourcePath : destPath);

        const fileUuid = generateUUID();

        const csvRow = [
          fileUuid,
          fileType,
          cameraId,
          filename,
          destPath,
          fileSize,
          fileHash,
          timestamp.toISOString(),
          'false',
          'false',
          JSON.stringify({ source: 'migration' })
        ].join('|') + '\n';

        csvStream.write(csvRow);

        if (result.movedFiles % 100 === 0) {
          console.log(`Progress: ${result.movedFiles}/${result.totalFiles} files migrated`);
        }
      } catch (error) {
        result.failedFiles++;
        result.errors.push(`Failed to migrate ${filename}: ${error.message}`);
        console.error(`Error migrating file ${filename}:`, error.message);
      }
    }
  } catch (error) {
    result.errors.push(`Error processing directory ${sourceDir}: ${error.message}`);
    console.error(`Error processing directory ${sourceDir}:`, error);
  }

  return result;
}

async function migrateAll(dryRun = false) {
  const baseDestDir = path.join(process.cwd(), 'data/detections');
  const sourceDirs = [
    { source: 'server/public/events', name: 'events' },
    { source: 'server/public/snapshots', name: 'snapshots' },
    { source: 'server/public/batch-results', name: 'batch-results' },
    { source: 'server/public/motion', name: 'motion' },
    { source: 'public/events', name: 'public-events' },
    { source: 'public/snapshots', name: 'public-snapshots' }
  ];

  const finalResult = {
    totalFiles: 0,
    movedFiles: 0,
    failedFiles: 0,
    errors: []
  };

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Starting migration...`);
  console.log(`Destination directory: ${baseDestDir}`);

  const csvPath = path.join(baseDestDir, 'migration_data.csv');
  const csvStream = fs.createWriteStream(csvPath, { flags: dryRun ? 'w' : 'a' });

  csvStream.write('file_uuid|file_type|camera_id|original_filename|storage_path|file_size|file_hash|capture_timestamp|is_archived|is_deleted|metadata\n');

  for (const { source, name } of sourceDirs) {
    const sourcePath = path.join(process.cwd(), source);

    try {
      const stats = await fsPromises.stat(sourcePath);
      if (stats.isDirectory()) {
        console.log(`\nMigrating ${name}...`);
        const result = await migrateDirectory(sourcePath, baseDestDir, dryRun, csvStream);

        finalResult.totalFiles += result.totalFiles;
        finalResult.movedFiles += result.movedFiles;
        finalResult.failedFiles += result.failedFiles;
        finalResult.errors.push(...result.errors);
      } else {
        console.log(`Skipping ${name}: not a directory`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        finalResult.errors.push(`Error accessing ${source}: ${error.message}`);
      }
    }
  }

  csvStream.end();

  return finalResult;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-n');

  try {
    const result = await migrateAll(dryRun);

    console.log('\n=== Migration Summary ===');
    console.log(`Total files: ${result.totalFiles}`);
    console.log(`Moved files: ${result.movedFiles}`);
    console.log(`Failed moves: ${result.failedFiles}`);
    console.log(`CSV data written to: data/detections/migration_data.csv`);

    if (result.errors.length > 0) {
      console.log('\n=== Migration Errors ===');
      result.errors.slice(0, 10).forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
      if (result.errors.length > 10) {
        console.log(`... and ${result.errors.length - 10} more errors`);
      }
    }

    if (result.movedFiles > 0 && result.failedFiles === 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Check the migrated files in data/detections/');
      console.log('2. Import migration_data.csv into PostgreSQL:');
      console.log('   docker exec -i sentryvision-db psql -U sentryvision -d sentryvision -c "\\COPY detection_files(file_uuid, file_type, camera_id, original_filename, storage_path, file_size, file_hash, capture_timestamp, is_archived, is_deleted, metadata) FROM STDIN WITH (FORMAT csv, DELIMITER \'|\', QUOTE \'\\\'\') " < data/detections/migration_data.csv');
      console.log('3. Verify database records: docker exec sentryvision-db psql -U sentryvision -d sentryvision -c "SELECT COUNT(*) FROM detection_files;"');
    } else if (result.movedFiles > 0 && result.failedFiles < result.movedFiles) {
      console.log('\n⚠️ Migration completed with some errors');
    } else {
      console.log('\n❌ Migration failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
