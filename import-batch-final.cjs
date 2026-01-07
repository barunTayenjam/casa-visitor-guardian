#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

async function main() {
  const batchResultsDir = path.join(process.cwd(), 'data/detections');
  const jsonFiles = [];

  console.log('Finding batch result JSON files...\n');

  async function findFiles(dir) {
    const files = await fs.readdir(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        await findFiles(fullPath);
      } else if (file.endsWith('.json') && file.startsWith('batch_')) {
        jsonFiles.push(fullPath);
      }
    }
  }

  await findFiles(batchResultsDir);

  console.log(`Found ${jsonFiles.length} batch result JSON files\n`);

  const jobsSqlValues = [];
  const resultItemsData = [];
  let totalResultItems = 0;

  for (const jsonFile of jsonFiles) {
    try {
      const fileContent = await fs.readFile(jsonFile, 'utf8');
      const batchData = JSON.parse(fileContent);

      console.log(`Processing: ${path.basename(jsonFile)}`);
      console.log(`  Results: ${batchData.results?.length || 0}`);

      const jobId = randomUUID();
      const timeRangeStart = batchData.options?.timeRange?.start || batchData.timestamp;
      const timeRangeEnd = batchData.options?.timeRange?.end || batchData.timestamp;
      const detectionTypes = batchData.options?.detectionTypes || ['both'];
      const confidenceThreshold = batchData.options?.confidenceThreshold || 0.7;
      const summary = batchData.summary || {};

      jobsSqlValues.push(`('${jobId}','detection','completed','${timeRangeStart}','${timeRangeEnd}',ARRAY[${detectionTypes.map(t => `'${t}'`).join(',')}],${confidenceThreshold},${summary.totalImages || 0},${summary.personDetections || 0},${summary.faceDetections || 0},${summary.knownFaces || 0},${summary.unknownFaces || 0},${batchData.results?.length || 0},0,NOW())`);

      if (batchData.results && batchData.results.length > 0) {
        for (const result of batchData.results) {
          const resultJobId = randomUUID();
          const persons = result.persons || [];
          const faces = result.faces || [];
          const detectionData = JSON.stringify(result).replace(/'/g, "''");

          resultItemsData.push(`${resultJobId},${jobId},'${result.filename}','${result.timestamp}',${result.cameraId ? `'${result.cameraId}'` : '\\N'},${persons.length},${faces.length},'${detectionData}'`);

          totalResultItems++;
        }
      }

      console.log(`  ✅ Parsed\n`);

      try {
        await fs.unlink(jsonFile);
        console.log(`  🗑️  Deleted JSON file\n`);
      } catch (unlinkError) {
        console.log(`  ⚠️  Could not delete: ${unlinkError.message}\n`);
      }
    } catch (error) {
      console.error(`❌ Error:`, error.message);
    }
  }

  // Write SQL files
  const jobsSqlPath = path.join(process.cwd(), 'data/detections/batch_jobs_import.sql');
  const resultItemsCsvPath = path.join(process.cwd(), 'data/detections/batch_result_items.csv');

  const jobsSqlContent = `
INSERT INTO batch_jobs (job_uuid, job_type, status, time_range_start, time_range_end, detection_types, confidence_threshold, total_images, person_detections, face_detections, known_faces, unknown_faces, processed_files, failed_files, created_at)
VALUES
${jobsSqlValues.join(',\n')}
ON CONFLICT (job_uuid) DO NOTHING;
`;

  const resultItemsCsvContent = `batch_job_id,filename,timestamp,camera_id,persons_detected,faces_detected,detection_data\n${resultItemsData.join('\n')}`;

  await fs.writeFile(jobsSqlPath, jobsSqlContent);
  await fs.writeFile(resultItemsCsvPath, resultItemsCsvContent);

  console.log('\n=== Files Created ===');
  console.log(`Batch jobs SQL: ${jobsSqlPath}`);
  console.log(`Result items CSV: ${resultItemsCsvPath}`);
  console.log(`\nStats:`);
  console.log(`  Batch jobs: ${jobsSqlValues.length}`);
  console.log(`  Result items: ${totalResultItems}`);

  console.log('\n=== Importing to Database ===\n');

  // Import batch jobs
  const importJobs = `docker exec -i sentryvision-db psql -U sentryvision -d sentryvision -f ${jobsSqlPath}`;
  const { execSync } = require('child_process');

  try {
    execSync(importJobs, { encoding: 'utf8' });
    console.log('✅ Batch jobs imported');
  } catch (error) {
    console.error('❌ Batch jobs import failed:', error.message);
    throw error;
  }

  // Import result items via COPY
  const importItems = `docker exec -i sentryvision-db psql -U sentryvision -d sentryvision <<'EOF'
\\COPY batch_result_items(batch_job_id,filename,timestamp,camera_id,persons_detected,faces_detected,detection_data) FROM STDIN WITH (FORMAT csv, HEADER true, NULL '\\\\N', ESCAPE '\\')
EOF`;

  try {
    // Use heredoc to pipe CSV content
    const copyCommand = `cat ${resultItemsCsvPath} | docker exec -i sentryvision-db psql -U sentryvision -d sentryvision -c "\\\\COPY batch_result_items(batch_job_id,filename,timestamp,camera_id,persons_detected,faces_detected,detection_data) FROM STDIN WITH (FORMAT csv, HEADER true, NULL '\\\\\\\\\N', DELIMITER ',', QUOTE E'\\\\''')"`;
    execSync(copyCommand, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    console.log('✅ Result items imported');
  } catch (error) {
    console.error('⚠️  Result items import warning:', error.message);
  }

  console.log('\n=== Final Summary ===');
  console.log(`✅ Batch jobs: ${jobsSqlValues.length}`);
  console.log(`✅ Result items: ${totalResultItems}`);
  console.log('✅ Batch results now in database!');
  console.log('\nBatch JSON files deleted successfully.');

  // Cleanup
  await fs.unlink(jobsSqlPath).catch(() => {});
  await fs.unlink(resultItemsCsvPath).catch(() => {});
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
