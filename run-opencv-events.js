#!/usr/bin/env node

console.log('🔍 Running OpenCV Processing on Recent Events...\n');

import path from 'path';
import fs from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const EVENTS_DIR = path.join(__dirname, 'server/public/events');
const OPENCV_SERVICE_URL = 'http://localhost:8084';
const RECENT_HOURS = 24; // Process events from last 24 hours

// Helper function to generate file hash
function generateFileHash(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const hashInput = `${filePath}_${stats.size}_${stats.mtime.getTime()}`;
    return createHash('md5').update(hashInput).digest('hex');
  } catch (error) {
    console.error('Error generating hash for', filePath, ':', error.message);
    return null;
  }
}

// Helper function to call OpenCV service
async function callOpenCVService(endpoint, imagePath, fileHash) {
  try {
    const response = await fetch(`${OPENCV_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imagePath,
        fileHash,
        fileSize: fs.statSync(imagePath).size,
        fileModified: fs.statSync(imagePath).mtime.toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ OpenCV service error for ${path.basename(imagePath)}:`, error.message);
    return null;
  }
}

// Get recent event files
function getRecentEventFiles() {
  try {
    if (!fs.existsSync(EVENTS_DIR)) {
      console.log(`❌ Events directory not found: ${EVENTS_DIR}`);
      return [];
    }

    const files = fs.readdirSync(EVENTS_DIR)
      .filter(file => file.endsWith('.jpg'))
      .map(file => {
        const filePath = path.join(EVENTS_DIR, file);
        const stats = fs.statSync(filePath);
        
        // Parse timestamp from filename
        const parts = file.split('_');
        if (parts.length < 3) return null;

        const timestampPart = parts[2].replace('.jpg', '');
        let timestamp;
        
        try {
          if (timestampPart.includes('T') && timestampPart.endsWith('Z')) {
            let cleanTimestamp = timestampPart;
            const tIndex = timestampPart.indexOf('T');
            const datePart = timestampPart.substring(0, tIndex);
            let timePart = timestampPart.substring(tIndex + 1);
            
            timePart = timePart.slice(0, -1); // Remove Z
            const timeComponents = timePart.split('-');
            
            if (timeComponents.length >= 3) {
              const fixedTime = `${timeComponents[0]}:${timeComponents[1]}:${timeComponents[2]}.${timeComponents[3] || '000'}`;
              cleanTimestamp = datePart + 'T' + fixedTime + 'Z';
            } else {
              cleanTimestamp = datePart + 'T' + timePart.replace(/-/g, ':') + 'Z';
            }
            
            timestamp = new Date(cleanTimestamp);
          } else {
            timestamp = new Date(timestampPart);
          }
          
          if (isNaN(timestamp.getTime())) return null;
        } catch {
          return null;
        }

        return {
          filename: file,
          filePath,
          timestamp,
          stats,
          cameraId: parts[1],
          eventType: parts[0] // motion, objects, faces
        };
      })
      .filter(item => item !== null)
      .filter(item => {
        // Only include files from the last RECENT_HOURS
        const cutoffTime = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000);
        return item.timestamp >= cutoffTime;
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first

    return files;
  } catch (error) {
    console.error('Error reading events directory:', error.message);
    return [];
  }
}

// Check if OpenCV service is running
async function checkOpenCVService() {
  try {
    const response = await fetch(`${OPENCV_SERVICE_URL}/health`);
    if (response.ok) {
      const health = await response.json();
      console.log('✅ OpenCV service is healthy:', health.status);
      return true;
    }
  } catch (error) {
    console.log('❌ OpenCV service is not running on', OPENCV_SERVICE_URL);
    console.log('💡 Start it with: cd opencv-service && npm start');
    return false;
  }
}

// Main processing function
async function processRecentEvents() {
  console.log(`📂 Looking for events from the last ${RECENT_HOURS} hours...\n`);

  // Check OpenCV service
  const serviceRunning = await checkOpenCVService();
  if (!serviceRunning) {
    process.exit(1);
  }

  // Get recent files
  const recentFiles = getRecentEventFiles();
  
  if (recentFiles.length === 0) {
    console.log('📭 No recent events found to process.');
    return;
  }

  console.log(`📸 Found ${recentFiles.length} recent event files:\n`);

  // Display files to be processed
  recentFiles.forEach((file, index) => {
    const timeAgo = Math.round((Date.now() - file.timestamp.getTime()) / (1000 * 60));
    console.log(`${index + 1}. ${file.filename}`);
    console.log(`   📅 ${file.timestamp.toLocaleString()} (${timeAgo} minutes ago)`);
    console.log(`   📹 Camera: ${file.cameraId} | Type: ${file.eventType}`);
    console.log(`   📊 Size: ${(file.stats.size / 1024).toFixed(1)} KB`);
    console.log('');
  });

  console.log('🚀 Starting OpenCV processing...\n');

  // Process each file
  const results = [];
  for (let i = 0; i < recentFiles.length; i++) {
    const file = recentFiles[i];
    console.log(`[${i + 1}/${recentFiles.length}] Processing: ${file.filename}`);

    const fileHash = generateFileHash(file.filePath);
    if (!fileHash) {
      console.log('   ❌ Failed to generate file hash');
      continue;
    }

    // Process object detection
    console.log('   🔍 Detecting objects...');
    const objectResult = await callOpenCVService('/detect-objects', file.filePath, fileHash);
    
    // Process face recognition
    console.log('   👤 Recognizing faces...');
    const faceResult = await callOpenCVService('/recognize-faces', file.filePath, fileHash);

    if (objectResult || faceResult) {
      results.push({
        file: file.filename,
        timestamp: file.timestamp,
        cameraId: file.cameraId,
        eventType: file.eventType,
        objectDetection: objectResult,
        faceRecognition: faceResult
      });
    }

    console.log('');
  }

  // Display results summary
  console.log('📊 PROCESSING RESULTS SUMMARY');
  console.log('='.repeat(50));

  if (results.length === 0) {
    console.log('❌ No files were successfully processed.');
    return;
  }

  let totalPersons = 0;
  let totalFaces = 0;
  let totalKnownFaces = 0;
  let totalProcessingTime = 0;

  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.file}`);
    console.log(`   📅 ${result.timestamp.toLocaleString()}`);
    console.log(`   📹 Camera: ${result.cameraId} | Type: ${result.eventType}`);

    // Object detection results
    if (result.objectDetection?.success) {
      const detections = result.objectDetection.detections || [];
      const persons = detections.filter(d => d.class === 'person');
      totalPersons += persons.length;
      
      console.log(`   🔍 Objects: ${detections.length} found`);
      if (persons.length > 0) {
        console.log(`      👥 Persons: ${persons.length} (confidence: ${persons.map(p => (p.confidence * 100).toFixed(1)).join('%, ')}%)`);
      }
      
      if (result.objectDetection.cached) {
        console.log(`   💾 Used cached result`);
      } else {
        console.log(`   ⏱️  Processing time: ${result.objectDetection.processingTime}ms`);
        totalProcessingTime += result.objectDetection.processingTime;
      }
    } else if (result.objectDetection) {
      console.log(`   ❌ Object detection failed: ${result.objectDetection.error}`);
    }

    // Face recognition results
    if (result.faceRecognition?.success) {
      const faces = result.faceRecognition.faceDetections || [];
      totalFaces += faces.length;
      const knownFaces = faces.filter(f => f.isKnown);
      totalKnownFaces += knownFaces.length;
      
      console.log(`   👤 Faces: ${faces.length} found`);
      if (knownFaces.length > 0) {
        console.log(`      ✅ Known faces: ${knownFaces.length} (${knownFaces.map(f => f.name || f.id).join(', ')})`);
      }
      if (faces.length > knownFaces.length) {
        console.log(`      ❓ Unknown faces: ${faces.length - knownFaces.length}`);
      }
      
      if (result.faceRecognition.cached) {
        console.log(`   💾 Used cached result`);
      } else if (result.faceRecognition.processingTime) {
        console.log(`   ⏱️  Processing time: ${result.faceRecognition.processingTime}ms`);
        totalProcessingTime += result.faceRecognition.processingTime;
      }
    } else if (result.faceRecognition) {
      console.log(`   ❌ Face recognition failed: ${result.faceRecognition.error}`);
    }
  });

  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('📈 FINAL SUMMARY');
  console.log('='.repeat(50));
  console.log(`📸 Files processed: ${results.length}/${recentFiles.length}`);
  console.log(`👥 Total persons detected: ${totalPersons}`);
  console.log(`👤 Total faces detected: ${totalFaces}`);
  console.log(`✅ Total known faces: ${totalKnownFaces}`);
  console.log(`❓ Total unknown faces: ${totalFaces - totalKnownFaces}`);
  if (totalProcessingTime > 0) {
    console.log(`⏱️  Total processing time: ${totalProcessingTime}ms (${(totalProcessingTime / 1000).toFixed(2)}s)`);
  }
  console.log(`📊 Average processing time per image: ${Math.round(totalProcessingTime / results.length)}ms`);

  // Show files with most activity
  const filesWithPersons = results.filter(r => r.objectDetection?.detections?.some(d => d.class === 'person'));
  const filesWithFaces = results.filter(r => r.faceRecognition?.faceDetections?.length > 0);

  if (filesWithPersons.length > 0) {
    console.log(`\n🎯 Files with person detections (${filesWithPersons.length}):`);
    filesWithPersons.forEach(r => {
      const persons = r.objectDetection.detections.filter(d => d.class === 'person');
      console.log(`   • ${r.file} - ${persons.length} person(s)`);
    });
  }

  if (filesWithFaces.length > 0) {
    console.log(`\n👥 Files with face detections (${filesWithFaces.length}):`);
    filesWithFaces.forEach(r => {
      const faces = r.faceRecognition.faceDetections;
      const known = faces.filter(f => f.isKnown).length;
      console.log(`   • ${r.file} - ${faces.length} face(s) (${known} known)`);
    });
  }

  console.log('\n✨ Processing complete!');
}

// Run the script
processRecentEvents().catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});