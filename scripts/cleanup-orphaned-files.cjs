#!/usr/bin/env node
// Script to clean up orphaned detection file records

const { execSync } = require('child_process');

console.log('Finding orphaned detection file records...\n');

let checked = 0;
let deleted = 0;
let errors = 0;

try {
    // Get all event records from database
    const result = execSync('docker exec sentryvision-postgres psql -U sentryvision -d sentryvision -t -c "SELECT id, storage_path FROM detection_files WHERE file_type IN (\'event_motion\', \'event_face\') AND storage_path IS NOT NULL ORDER BY id;"', { encoding: 'utf8' });
    
    const lines = result.trim().split('\n');
    
    for (const line of lines) {
        // Format: "id | path" or "  id | path"
        const match = line.match(/^\s*(\d+)\s*\|\s*(.+)$/);
        if (match) {
            const id = match[1].trim();
            const path = match[2].trim();
            
            if (path) {
                checked++;
                
                try {
                    // Check if file exists
                    execSync(`docker exec sentryvision-backend test -f "${path}"`, { stdio: 'pipe' });
                } catch {
                    // File doesn't exist - delete the record
                    console.log(`Deleting orphaned: ${id} -> ${path}`);
                    try {
                        execSync(`docker exec sentryvision-postgres psql -U sentryvision -d sentryvision -c "DELETE FROM detection_files WHERE id = ${id};"`, { stdio: 'pipe' });
                        deleted++;
                    } catch (delErr) {
                        console.error(`Failed to delete ${id}: ${delErr.message}`);
                        errors++;
                    }
                }
                
                // Progress indicator
                if (checked % 100 === 0) {
                    console.log(`Checked ${checked} records...`);
                }
            }
        }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Checked: ${checked}`);
    console.log(`Deleted: ${deleted}`);
    console.log(`Errors: ${errors}`);
    
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
