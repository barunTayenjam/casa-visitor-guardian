#!/usr/bin/env node
/**
 * Re-index detection files from disk into database
 * Scans /app/data/detections for image files and adds them to detection_files table
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DETECTIONS_DIR = '/app/data/detections';

async function runCommand(cmd) {
    try {
        return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    } catch (err) {
        return null;
    }
}

async function getExistingFiles() {
    console.log('Fetching existing files from database...');
    const result = await runCommand(
        'docker exec sentryvision-postgres psql -U sentryvision -d sentryvision -t -c "SELECT original_filename FROM detection_files;"'
    );
    
    const existing = new Set();
    if (result) {
        result.trim().split('\n').forEach(line => {
            const filename = line.trim();
            if (filename) existing.add(filename);
        });
    }
    console.log(`Database has ${existing.size} existing files\n`);
    return existing;
}

function parseFilename(filename) {
    const match = filename.match(/^(motion|face|event)_(cam\d+)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z)\.jpg$/i);
    
    if (!match) {
        return null;
    }
    
    const [_, type, cameraId, timestampStr] = match;
    
    const timestamp = timestampStr.replace('T', ' ').replace(/-(\d{2})-(\d{2})-(\d{2})/, ' $1:$2:$3').slice(0, 19);
    
    const yearMonth = timestampStr.substring(0, 7);
    
    let fileType = 'event_motion';
    if (type.toLowerCase() === 'face' || filename.includes('face_')) {
        fileType = 'event_face';
    }
    
    let storagePath;
    if (fileType === 'event_face') {
        storagePath = `${DETECTIONS_DIR}/${yearMonth}/events/faces/${filename}`;
    } else {
        storagePath = `${DETECTIONS_DIR}/${yearMonth}/events/motion/${filename}`;
    }
    
    return {
        original_filename: filename,
        camera_id: cameraId,
        capture_timestamp: timestamp,
        storage_path: storagePath,
        file_type: fileType,
        file_size: 0
    };
}

async function insertFile(fileInfo) {
    const sql = `INSERT INTO detection_files (original_filename, camera_id, capture_timestamp, storage_path, file_type, file_size, is_deleted, created_at, updated_at, metadata) VALUES ('${fileInfo.original_filename}', '${fileInfo.camera_id}', '${fileInfo.capture_timestamp}', '${fileInfo.storage_path}', '${fileInfo.file_type}', ${fileInfo.file_size}, FALSE, NOW(), NOW(), '{}'::jsonb) ON CONFLICT (original_filename) DO NOTHING`;
    return runCommand(`docker exec sentryvision-postgres psql -U sentryvision -d sentryvision -c "${sql.replace(/"/g, '\\"')}"`);
}

async function scanDirectory(dir, existingFiles, stats) {
    if (!fs.existsSync(dir)) {
        return;
    }
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg'));
    console.log(`Scanning ${dir}: ${files.length} files`);
    
    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const filename of files) {
        if (existingFiles.has(filename)) {
            skipped++;
            continue;
        }
        
        const fileInfo = parseFilename(filename);
        if (!fileInfo) {
            errors++;
            if (errors <= 5) {
                console.log(`  Could not parse: ${filename}`);
            }
            continue;
        }
        
        try {
            const fullPath = path.join(dir, filename);
            fileInfo.file_size = fs.statSync(fullPath).size;
        } catch (e) {
            continue;
        }
        
        const result = await insertFile(fileInfo);
        if (result !== null) {
            inserted++;
            stats.totalInserted++;
        }
    }
    
    console.log(`  Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}\n`);
    stats.totalChecked += files.length;
    stats.totalSkipped += skipped;
}

async function main() {
    console.log('========================================');
    console.log('  Detection Files Re-index Script');
    console.log('========================================\n');
    
    const stats = { totalChecked: 0, totalInserted: 0, totalSkipped: 0 };
    
    const existingFiles = await getExistingFiles();
    
    console.log('Scanning for files to index...\n');
    
    const motionBaseDir = `${DETECTIONS_DIR}/events/motion`;
    if (fs.existsSync(motionBaseDir)) {
        const years = fs.readdirSync(motionBaseDir).filter(d => /^\d{4}-\d{2}$/.test(d));
        for (const yearMonth of years.sort().reverse()) {
            await scanDirectory(`${motionBaseDir}/${yearMonth}`, existingFiles, stats);
        }
    }
    
    const faceBaseDir = `${DETECTIONS_DIR}/events/faces`;
    if (fs.existsSync(faceBaseDir)) {
        const years = fs.readdirSync(faceBaseDir).filter(d => /^\d{4}-\d{2}$/.test(d));
        for (const yearMonth of years.sort().reverse()) {
            await scanDirectory(`${faceBaseDir}/${yearMonth}`, existingFiles, stats);
        }
    }
    
    console.log('========================================');
    console.log('  Summary');
    console.log('========================================');
    console.log(`Total files checked: ${stats.totalChecked}`);
    console.log(`Files skipped (already in DB): ${stats.totalSkipped}`);
    console.log(`Files newly indexed: ${stats.totalInserted}`);
    console.log('========================================\n');
    
    const countResult = await runCommand(
        'docker exec sentryvision-postgres psql -U sentryvision -d sentryvision -t -c "SELECT COUNT(*) FROM detection_files WHERE file_type IN (\'event_motion\', \'event_face\');"'
    );
    
    if (countResult) {
        console.log(`Total records in database: ${countResult.trim()}`);
    }
}

main().catch(console.error);
