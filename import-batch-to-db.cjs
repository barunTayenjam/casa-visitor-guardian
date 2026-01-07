#!/usr/bin/env node

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const { createHash, randomUUID } = require('crypto');

async function main() {
  const batchResultsDir = path.join(process.cwd(), 'data/detections');
  const jsonFiles = [];

  console.log('Finding batch result JSON files...\n');

  async function findFiles(dir) {
    const files = await fsPromises.readdir(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = await fsPromises.stat(fullPath);
      if (stat.isDirectory()) {
        await findFiles(fullPath);
      } else if (file.endsWith('.json') && file.startsWith('batch_')) {
        jsonFiles.push(fullPath);
      }
    }
  }

  await findFiles(batchResultsDir);

  console.log(`Found ${jsonFiles.length} batch result JSON files\n`);

  const jobsSql = [];
  const resultItemsData = [];
  let totalResultItems = 0;

  for (const jsonFile of jsonFiles) {
    try {
      const fileContent = await fsPromises.readFile(jsonFile, 'utf8');
      const batchData = JSON.parse(fileContent);

      console.log(`Processing: ${path.basename(jsonFile)}`);
      console.log(`  Job ID: ${batchData.jobId}`);
      console.log(`  Results: ${batchData.results?.length || 0}`);

      const jobId = randomUUID();
      const timeRangeStart = batchData.options?.timeRange?.start || batchData.timestamp;
      const timeRangeEnd = batchData.options?.timeRange?.end || batchData.timestamp;
      const detectionTypes = batchData.options?.detectionTypes || ['both'];
      const confidenceThreshold = batchData.options?.confidenceThreshold || 0.7;
      const summary = batchData.summary || {};

      jobsSql.push(`('${jobId}', 'detection', 'completed', '${timeRangeStart}', '${timeRangeEnd}', ARRAY[${detectionTypes.map(t => `'${t}'`).join(',')}], ${confidenceThreshold}, ${summary.totalImages || 0}, ${summary.personDetections || 0}, ${summary.faceDetections || 0}, ${summary.knownFaces || 0}, ${summary.unknownFaces || 0}, ${batchData.results?.length || 0}, 0)`);

      if (batchData.results && batchData.results.length > 0) {
        for (const result of batchData.results) {
          const resultJobId = randomUUID();
          const persons = result.persons || [];
          const faces = result.faces || [];

          const detectionData = JSON.stringify(result).replace(/'/g, "''");
          const detectionFileUuid = randomUUID();

          resultItemsData.push(`${resultJobId},${jobId},'${result.filename}','${result.timestamp}',${result.cameraId ? `'${result.cameraId}'` : 'NULL'},${persons.length},${faces.length},'${detectionData}'`);

          totalResultItems++;
        }
      }

      console.log(`  ✅ Parsed for import\n`);

      try {
        await fsPromises.unlink(jsonFile);
        console.log(`  🗑️  Deleted JSON file\n`);
      } catch (unlinkError) {
        console.log(`  ⚠️  Could not delete: ${unlinkError.message}\n`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${jsonFile}:`, error.message);
    }
  }

  // Write SQL files
  const jobsSqlPath = path.join(process.cwd(), 'data/detections/batch_jobs_import.sql');
  const resultItemsSqlPath = path.join(process.cwd(), 'data/detections/batch_result_items_import.sql');

  const jobsSqlContent = `
INSERT INTO batch_jobs (job_uuid, job_type, status, time_range_start, time_range_end, detection_types, confidence_threshold, total_images, person_detections, face_detections, known_faces, unknown_faces, processed_files, failed_files, created_at)
VALUES
${jobsSql.join(',\n')}
ON CONFLICT (job_uuid) DO NOTHING;
`;

  const resultItemsSqlContent = `batch_job_id,filename,timestamp,camera_id,persons_detected,faces_detected,detection_data
${resultItemsData.join('\n')}`;

  await fsPromises.writeFile(jobsSqlPath, jobsSqlContent);
  await fsPromises.writeFile(resultItemsSqlPath, resultItemsSqlContent);

  console.log('\n=== Import Summary ===');
  console.log(`Batch jobs to import: ${jobsSql.length}`);
  console.log(`Result items to import: ${totalResultItems}`);
  console.log(`SQL files created:`);
  console.log(`  - ${jobsSqlPath}`);
  console.log(`  - ${resultItemsSqlPath}`);
  console.log('\nNow importing to database...\n');

  // Import batch jobs
  const importJobs = spawn('docker', [
    'exec', '-i', 'sentryvision-db',
    'psql', '-U', 'sentryvision', '-d', 'sentryvision',
    '-f', jobsSqlPath
  ], { stdio: 'inherit' });

  await new Promise((resolve, reject) => {
    importJobs.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Import jobs failed with code ${code}`));
      }
    });
  });

  console.log('\n✅ Batch jobs imported!');

  // Import result items using COPY
  const importItems = spawn('bash', ['-c', `
    cat ${resultItemsSqlPath} | docker exec -i sentryvision-db psql -U sentryvision -d sentryvision -c "\\\\COPY batch_result_items(batch_job_id,filename,timestamp,camera_id,persons_detected,faces_detected,detection_data) FROM STDIN WITH (FORMAT csv, HEADER false, DELIMITER ',')"
  `], { stdio: 'inherit' });

  await new Promise((resolve, reject) => {
    importItems.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Import result items failed with code ${code}`));
      }
    });
  });

  console.log('\n✅ Batch result items imported!');

  // Update batch jobs with completion
  const completeJobs = spawn('docker', [
    'exec', '-i', 'sentryvision-db',
    'psql', '-U', 'sentryvision', '-d', 'sentryvision',
    '-c', 'UPDATE batch_jobs SET completed_at = NOW(), started_at = NOW() WHERE completed_at IS NULL;'
  ], { stdio: 'inherit' });

  await new Promise((resolve, reject) => {
    completeJobs.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Complete jobs failed with code ${code}`));
      }
    });
  });

  console.log('\n=== Final Summary ===');
  console.log(`✅ Total batch jobs imported: ${jobsSql.length}`);
  console.log(`✅ Total result items imported: ${totalResultItems}`);
  console.log(`✅ All batch JSON files deleted`);
  console.log('\nBatch results now stored in database instead of JSON files!');

  // Cleanup SQL files
  await fsPromises.unlink(jobsSqlPath).catch(() => {});
  await fsPromises.unlink(resultItemsSqlPath).catch(() => {});
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
