#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';

console.log('Testing batch results API...');

// Test 1: Check if server is running
const testServer = () => {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:9754/api/batch/jobs', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          resolve(response);
        } else {
          reject(new Error(`Server returned ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout - server not responding'));
    });
    
    req.end();
  });
};

// Test 2: Test specific job results
const testJobResults = async (jobId) => {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:9754/api/batch/jobs/${jobId}/results`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`Job Results Status: ${res.statusCode}`);
        console.log(`Response Length: ${data.length}`);
        
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          console.log('Response keys:', Object.keys(response));
          console.log('Success:', response.success);
          
          if (response.success && response.results) {
            console.log('Results found:', {
              jobId: response.results.jobId,
              summary: response.results.summary,
              resultCount: response.results.results?.length || 0,
              hasDetectionData: response.results.results?.[0]?.persons || response.results.results?.[0]?.faces
            });
          }
          
          resolve(response);
        } else {
          console.log('Error response:', data);
          reject(new Error(`API Error: ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout getting job results'));
    });
    
    req.end();
  });
};

// Test 3: Check batch files exist
const checkBatchFiles = () => {
  const batchDir = '/Users/baruntayenjam/Code/home-security/server/public/batch-results';
  
  if (!fs.existsSync(batchDir)) {
    console.log('❌ Batch results directory not found');
    return false;
  }
  
  const files = fs.readdirSync(batchDir).filter(f => f.endsWith('.json'));
  console.log(`✅ Found ${files.length} batch result files`);
  
  if (files.length > 0) {
    const firstFile = files[0];
    const content = fs.readFileSync(path.join(batchDir, firstFile), 'utf8');
    const data = JSON.parse(content);
    
    console.log(`✅ Sample file: ${firstFile}`);
    console.log(`   - Job ID: ${data.jobId}`);
    console.log(`   - Total Images: ${data.summary?.totalImages || 0}`);
    console.log(`   - Person Detections: ${data.summary?.personDetections || 0}`);
    console.log(`   - Face Detections: ${data.summary?.faceDetections || 0}`);
    console.log(`   - Results Array Length: ${data.results?.length || 0}`);
    
    if (data.results && data.results.length > 0) {
      const sampleResult = data.results[0];
      console.log(`   - Sample Result: ${sampleResult.filename}`);
      console.log(`     * Persons: ${sampleResult.persons?.length || 0}`);
      console.log(`     * Faces: ${sampleResult.faces?.length || 0}`);
      
      if (sampleResult.persons && sampleResult.persons.length > 0) {
        console.log(`     * Person Bounding Box:`, sampleResult.persons[0].boundingBox);
      }
      
      if (sampleResult.faces && sampleResult.faces.length > 0) {
        console.log(`     * Face Bounding Box:`, sampleResult.faces[0].boundingBox);
      }
    }
    
    return { jobId: data.jobId, hasData: true };
  }
  
  return { hasData: false };
};

// Run tests
async function runTests() {
  try {
    console.log('=== Test 1: Check Batch Files ===');
    const batchInfo = checkBatchFiles();
    
    if (!batchInfo.hasData) {
      console.log('❌ No batch data found');
      return;
    }
    
    console.log('\n=== Test 2: Check Server ===');
    const serverResponse = await testServer();
    console.log('✅ Server is running');
    console.log(`   - Jobs found: ${serverResponse.jobs?.length || 0}`);
    
    if (serverResponse.jobs && serverResponse.jobs.length > 0) {
      const completedJob = serverResponse.jobs.find(j => j.status === 'completed');
      if (completedJob) {
        console.log(`   - Found completed job: ${completedJob.id}`);
        
        console.log('\n=== Test 3: Test Job Results API ===');
        await testJobResults(completedJob.id);
      } else {
        console.log('❌ No completed jobs found');
      }
    } else {
      console.log('❌ No jobs found in server');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n=== Fix Attempt ===');
    console.log('The issue might be:');
    console.log('1. Server not running on port 9754');
    console.log('2. Job IDs not matching between memory and files');
    console.log('3. API endpoint returning wrong format');
    
    // Try to find matching job
    console.log('\n=== Finding Job ID Match ===');
    const batchInfo = checkBatchFiles();
    if (batchInfo.jobId) {
      console.log(`Testing with file job ID: ${batchInfo.jobId}`);
      testJobResults(batchInfo.jobId).catch(err => {
        console.log('Failed with file job ID too:', err.message);
      });
    }
  }
}

runTests();