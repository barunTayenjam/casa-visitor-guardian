#!/usr/bin/env node
/**
 * Re-index detection files from disk into database
 * Runs on host - uses docker exec to interact with database
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DETECTIONS_DIR = process.env.DETECTIONS_DIR || './data/detections';

async function runCommand(cmd) {
    try {
        return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    } catch (err) {
        return null;
    }
}

function runCommandSync(cmd) {
    try {
        return execSync(cmd, { encoding: 'utf8', stdio: 'inherit' });
    } catch (err) {
        return null;
    }
}

async function getExistingFiles() {
    console.log('Fetching existing files from database...');
    try {
        const result = execSync(
            'docker exec sentryvision-postgres psql -U sentryvision -d sentryvision -t -A -c "SELECT original_filename FROM detection_files WHERE file_type IN (\'event_motion\', \'event_face\');" 2>/dev/null',
            { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
        );
        
        const existing = new Set();
        if (result && typeof result === 'string') {
            result.trim().split('\n').forEach(line => {
                const filename = line.trim();
                if (filename) existing.add(filename);
            });
        }
        console.log(`Database has ${existing.size} existing files\n`);
        return existing;
    } catch (err) {
        console.log(`Error fetching files: ${err.message}\n`);
        return new Set();
    }
}

function parseFilename(filename) {
    const match = filename.match(/^(motion|face|event)_(cam\d+)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z)\.jpg$/i);
    
    if (!match) {
        return null;
    }
    
    const [_, type, cameraId, timestampStr] = match;
    
    // Parse timestamp: 2025-07-05T15-51-42-663Z -> 2025-07-05 15:51:42
    const tsMatch = timestampStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
    const timestamp = tsMatch ? `${tsMatch[1]}-${tsMatch[2]}-${tsMatch[3]} ${tsMatch[4]}:${tsMatch[5]}:${tsMatch[6]}` : timestampStr;
    
    const yearMonth = timestampStr.substring(0, 7);
    
    let fileType = 'event_motion';
    if (type.toLowerCase() === 'face' || filename.includes('face_')) {
        fileType = 'event_face';
    }
    
    let storagePath;
    if (fileType === 'event_face') {
        storagePath = `/app/data/detections/${yearMonth}/events/faces/${filename}`;
    } else {
        storagePath = `/app/data/detections/${yearMonth}/events/motion/${filename}`;
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

function getFileSize(filePath) {
    try {
        return fs.statSync(filePath).size;
    } catch (e) {
        return 0;
    }
}

function insertFile(fileInfo) {
    const sql = `INSERT INTO detection_files (original_filename, camera_id, capture_timestamp, storage_path, file_type, file_size, is_deleted, created_at, updated_at, metadata) VALUES ('${fileInfo.original_filename}', '${fileInfo.camera_id}', '${fileInfo.capture_timestamp}', '${fileInfo.storage_path}', '${fileInfo.file_type}', ${fileInfo.file_size}, FALSE, NOW(), NOW(), '{}'::jsonb) ON CONFLICT (original_filename) DO NOTHING RETURNING id`;
    
    return runCommand(
        `docker exec sentryvision-postgres psql -U sentryvision -d sentryvision -t -A -c "${sql.replace(/"/g, '\\"')}"`
    );
}

async function batchInsert(files) {
    if (files.length === 0) return 0;
    
    const values = files.map(f => 
        `('${f.original_filename}', '${f.camera_id}', '${f.capture_timestamp}', '${f.storage_path}', '${f.file_type}', ${f.file_size}, FALSE, NOW(), NOW(), '{}'::jsonb)`
    ).join(', ');
    
    const sql = `INSERT INTO detection_files (original_filename, camera_id, capture_timestamp, storage_path, file_type, file_size, is_deleted, created_at, updated_at, metadata) VALUES ${values}`;
    
    const result = runCommand(
        `docker exec sentryvision-postgres psql -U sentryvision -d sentryvision -t -A -c "${sql.replace(/"/g, '\\"')}" 2>&1`
    );
    
    if (result && typeof result === 'string' && result.includes('INSERT')) {
        return files.length;
    }
    return 0;
}

async function scanDirectory(dir, existingFiles, stats, batchSize = 50) {
    if (!fs.existsSync(dir)) {
        console.log(`Directory does not exist: ${dir}`);
        return;
    }
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg'));
    console.log(`Scanning ${dir}: ${files.length} files`);
    
    let batch = [];
    
    for (const filename of files) {
        if (existingFiles.has(filename)) {
            stats.totalSkipped++;
            continue;
        }
        
        const fileInfo = parseFilename(filename);
        if (!fileInfo) {
            stats.errors++;
            if (stats.errors <= 5) {
                console.log(`  Could not parse: ${filename}`);
            }
            continue;
        }
        
        fileInfo.file_size = getFileSize(path.join(dir, filename));
        batch.push(fileInfo);
        
        if (batch.length >= batchSize) {
            const inserted = await batchInsert(batch);
            stats.totalInserted += inserted;
            batch = [];
            
            if ((stats.totalChecked + stats.totalInserted) % 1000 === 0) {
                console.log(`  Progress: checked ${stats.totalChecked + stats.totalInserted}, inserted ${stats.totalInserted}`);
            }
        }
    }
    
    // Insert remaining batch
    if (batch.length > 0) {
        const inserted = await batchInsert(batch);
        stats.totalInserted += inserted;
    }
    
    stats.totalChecked += files.length;
    console.log(`  Done: checked ${files.length}, inserted ${stats.totalInserted}\n`);
}

async function main() {
    console.log('========================================');
    console.log('  Detection Files Re-index Script');
    console.log('========================================\n');
    
    const stats = { totalChecked: 0, totalInserted: 0, totalSkipped: 0, errors: 0 };
    
    const existingFiles = await getExistingFiles();
    
    console.log('Scanning for files to index...\n');
    
    // Scan year-month directories
    const yearMonths = fs.readdirSync(DETECTIONS_DIR).filter(d => /^\d{4}-\d{2}$/.test(d));
    console.log(`Found year-month directories: ${yearMonths.join(', ')}\n`);
    
    for (const yearMonth of yearMonths.sort().reverse()) {
        const motionDir = `${DETECTIONS_DIR}/${yearMonth}/events/motion`;
        await scanDirectory(motionDir, existingFiles, stats);
        
        const faceDir = `${DETECTIONS_DIR}/${yearMonth}/events/faces`;
        await scanDirectory(faceDir, existingFiles, stats);
    }
    
    console.log('========================================');
    console.log('  Summary');
    console.log('========================================');
    console.log(`Total files checked: ${stats.totalChecked}`);
    console.log(`Files skipped (already in DB): ${stats.totalSkipped}`);
    console.log(`Files newly indexed: ${stats.totalInserted}`);
    console.log(`Parse errors: ${stats.errors}`);
    console.log('========================================\n');
    
    const countResult = runCommand(
        'docker exec sentryvision-postgres psql -U sentryvision -d sentryvision -t -A -c "SELECT COUNT(*) FROM detection_files WHERE file_type IN (\'event_motion\', \'event_face\');" 2>/dev/null'
    );
    
    if (countResult && typeof countResult === 'string') {
        console.log(`Total records in database: ${countResult.trim()}`);
    }
}

main().catch(console.error);
