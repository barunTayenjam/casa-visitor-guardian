#!/usr/bin/env node

/**
 * Test script to verify person detection scan functionality
 */

import http from 'http';

const testScanEndpoint = () => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({});
    
    const options = {
      hostname: 'localhost',
      port: 9753,
      path: '/api/scan-snapshots-for-persons',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('✅ Response Status:', res.statusCode);
          console.log('✅ Response Data:', JSON.stringify(response, null, 2));
          
          if (res.statusCode === 200 || res.statusCode === 503) {
            resolve(response);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${response.error || 'Unknown error'}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
};

const main = async () => {
  console.log('🧪 Testing Person Detection Scan Endpoint...');
  console.log('📡 Target: http://localhost:9753/api/scan-snapshots-for-persons');
  console.log('');
  
  try {
    const result = await testScanEndpoint();
    
    if (result.success === false && result.error === 'Person detector not initialized') {
      console.log('❌ ISSUE IDENTIFIED: Person detector not initialized');
      console.log('');
      console.log('🔧 TROUBLESHOOTING STEPS:');
      console.log('1. Check if TensorFlow.js is properly loaded');
      console.log('2. Verify global.personDetector is set');
      console.log('3. Ensure setupPersonDetection() completed successfully');
      console.log('4. Check server startup logs for errors');
    } else if (result.success === true) {
      console.log('✅ SUCCESS: Person detection scan completed');
      console.log(`📊 Processed: ${result.processed} images`);
      console.log(`👥 Detected: ${result.detected} persons`);
    } else {
      console.log('⚠️  UNEXPECTED RESPONSE:', result);
    }
    
  } catch (error) {
    console.log('❌ TEST FAILED:', error.message);
    console.log('');
    console.log('🔧 POSSIBLE ISSUES:');
    console.log('1. Server not running on port 9753');
    console.log('2. Endpoint not available');
    console.log('3. Network connectivity issue');
  }
};

main();