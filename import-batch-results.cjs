#!/usr/bin/env node

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function importBatchResults() {
  const batchResultsDir = path.join(process.cwd(), 'data/detections');
  const jsonFiles = [];

  try {
    console.log('Finding batch result JSON files...');

    const findFiles = async (dir) => {
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
    };

    await findFiles(batchResultsDir);

    console.log(`Found ${jsonFiles.length} batch result JSON files\n`);

    let totalJobs = 0;
    let totalResultItems = 0;

    for (const jsonFile of jsonFiles) {
      try {
        const fileContent = await fsPromises.readFile(jsonFile, 'utf8');
        const batchData = JSON.parse(fileContent);

        console.log(`Processing: ${path.basename(jsonFile)}`);
        console.log(`  Job ID: ${batchData.jobId}`);
        console.log(`  Timestamp: ${batchData.timestamp}`);
        console.log(`  Summary:`, batchData.summary);

        const jobId = await createBatchJob(batchData);
        console.log(`  Created batch job ID: ${jobId}`);

        if (batchData.results && batchData.results.length > 0) {
          const resultItemsCount = await insertBatchResultItems(jobId, batchData.results);
          totalResultItems += resultItemsCount;
          console.log(`  Inserted ${resultItemsCount} result items`);
        }

        await completeBatchJob(jobId, batchData.summary);

        totalJobs++;
        totalResultItems += batchData.results?.length || 0;

        console.log(`  ✅ Imported successfully\n`);

        // Delete JSON file after successful import
        try {
          await fsPromises.unlink(jsonFile);
          console.log(`  🗑️  Deleted JSON file\n`);
        } catch (unlinkError) {
          console.log(`  ⚠️  Could not delete JSON file: ${unlinkError.message}\n`);
        }
      } catch (error) {
        console.error(`❌ Error processing ${jsonFile}:`, error.message);
      }
    }

    console.log('\n=== Import Summary ===');
    console.log(`Total batch jobs imported: ${totalJobs}`);
    console.log(`Total result items imported: ${totalResultItems}`);
    console.log('✅ Batch results import completed!');

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

async function createBatchJob(batchData) {
  const query = `
    INSERT INTO batch_jobs (
      job_uuid,
      job_type,
      status,
      time_range_start,
      time_range_end,
      detection_types,
      confidence_threshold,
      created_at
    ) VALUES (
      $1, 'detection', 'completed',
      $2, $3, $4, $5, NOW()
    ) RETURNING id
  `;

  const timeRangeStart = batchData.options?.timeRange?.start || batchData.timestamp;
  const timeRangeEnd = batchData.options?.timeRange?.end || batchData.timestamp;
  const detectionTypes = batchData.options?.detectionTypes || ['both'];
  const confidenceThreshold = batchData.options?.confidenceThreshold || 0.7;

  const values = [
    batchData.jobId,
    timeRangeStart,
    timeRangeEnd,
    `{${detectionTypes.join(',')}}`,
    confidenceThreshold
  ];

  try {
    const psqlCmd = [
      'docker', 'exec', '-i', 'sentryvision-db',
      'psql', '-U', 'sentryvision', '-d', 'sentryvision',
      '-c', query + ` -- ${values.map(v => `'${v}'`).join(' ')}`
    ].join(' ');

    const result = execSync(psqlCmd, { encoding: 'utf8' });
    const match = result.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  } catch (error) {
    console.error('Error creating batch job:', error.message);
    throw error;
  }
}

async function insertBatchResultItems(jobId, results) {
  const items = [];

  for (const result of results) {
    const persons = result.persons || [];
    const faces = result.faces || [];

    items.push({
      jobId,
      filename: result.filename,
      timestamp: result.timestamp,
      cameraId: result.cameraId,
      personsDetected: persons.length,
      facesDetected: faces.length,
      detectionData: JSON.stringify(result)
    });
  }

  if (items.length === 0) {
    return 0;
  }

  const tempFile = path.join(process.cwd(), 'data/detections/batch_import_temp.csv');
  const csvContent = [
    'batch_job_id,filename,timestamp,camera_id,persons_detected,faces_detected,detection_data\n',
    ...items.map(item =>
      [
        item.jobId,
        item.filename,
        item.timestamp,
        item.cameraId || '',
        item.personsDetected,
        item.facesDetected,
        `"${item.detectionData.replace(/"/g, '""')}"`
      ].join(',')
    )
  ].join('');

  await fsPromises.writeFile(tempFile, csvContent);

  try {
    const importCmd = [
      'docker', 'exec', '-i', 'sentryvision-db',
      'psql', '-U', 'sentryvision', '-d', 'sentryvision',
      '-c', `\\COPY batch_result_items(batch_job_id,filename,timestamp,camera_id,persons_detected,faces_detected,detection_data) FROM STDIN WITH (FORMAT csv, HEADER true) < ${tempFile}`
    ].join(' ');

    // Create copy command and stream the file
    const copyCmd = [
      'cat', tempFile, '|',
      'docker', 'exec', '-i', 'sentryvision-db',
      'psql', '-U', 'sentryvision', '-d', 'sentryvision',
      '-c', `\\COPY batch_result_items(batch_job_id,filename,timestamp,camera_id,persons_detected,faces_detected,detection_data) FROM STDIN WITH (FORMAT csv, HEADER true)`
    ].join(' ');

    execSync(copyCmd, { encoding: 'utf8' });

    await fsPromises.unlink(tempFile);
    return items.length;
  } catch (error) {
    console.error('Error inserting batch result items:', error.message);
    await fsPromises.unlink(tempFile).catch(() => {});
    throw error;
  }
}

async function completeBatchJob(jobId, summary) {
  const query = `
    UPDATE batch_jobs
    SET
      status = 'completed',
      completed_at = NOW(),
      total_images = $1,
      person_detections = $2,
      face_detections = $3,
      known_faces = $4,
      unknown_faces = $5,
      processed_files = $1
    WHERE id = ${jobId}
  `;

  const values = [
    summary.totalImages || 0,
    summary.personDetections || 0,
    summary.faceDetections || 0,
    summary.knownFaces || 0,
    summary.unknownFaces || 0
  ];

  try {
    const psqlCmd = [
      'docker', 'exec', '-i', 'sentryvision-db',
      'psql', '-U', 'sentryvision', '-d', 'sentryvision',
      '-c', query.replace(/\$\d+/g, (_, i) => values[i])
    ].join(' ');

    execSync(psqlCmd, { encoding: 'utf8' });
  } catch (error) {
    console.error('Error completing batch job:', error.message);
    throw error;
  }
}

importBatchResults();
