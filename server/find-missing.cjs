#!/usr/bin/env node
// Find files on disk that don't have database records - runs inside container

const { execSync } = require('child_process');
const fs = require('fs');

console.log('Finding files on disk without database records...\n');

let checked = 0;
let missing = 0;

try {
    // Get all filenames from database
    const dbResult = execSync('psql -U sentryvision -d sentryvision -t -c "SELECT original_filename FROM detection_files WHERE file_type IN (\'event_motion\', \'event_face\');"', { encoding: 'utf8' });
    
    const dbFiles = new Set();
    dbResult.trim().split('\n').forEach(line => {
        const filename = line.trim();
        if (filename) {
            dbFiles.add(filename);
        }
    });
    
    console.log(`Database has ${dbFiles.size} files tracked`);
    console.log('');
    
    // Scan motion directory
    const motionDir = '/app/data/detections/2026-01/events/motion';
    
    if (fs.existsSync(motionDir)) {
        const files = fs.readdirSync(motionDir).filter(f => f.endsWith('.jpg'));
        console.log(`Scanning ${motionDir}: ${files.length} files`);
        
        for (const file of files) {
            checked++;
            if (!dbFiles.has(file)) {
                if (missing < 20) {
                    console.log(`NOT IN DB: ${file}`);
                }
                missing++;
            }
            
            if (checked % 5000 === 0) {
                console.log(`Checked ${checked} files... (missing: ${missing})`);
            }
        }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Total files checked: ${checked}`);
    console.log(`Files not in database: ${missing}`);
    
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
