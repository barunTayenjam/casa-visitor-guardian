#!/usr/bin/env node

/**
 * Test script for batch person detection functionality
 * This script tests the batch processing API endpoints
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001'; // Adjust port as needed

async function testBatchDetectionAPI() {
  console.log('🧪 Testing Batch Person Detection API...\n');

  try {
    // Test 1: Check initial status
    console.log('1. Testing initial status...');
    const statusResponse = await fetch(`${BASE_URL}/api/person/batch/status`);
    const statusData = await statusResponse.json();
    console.log('✅ Initial Status:', JSON.stringify(statusData, null, 2));

    // Test 2: Get available results (should be empty initially)
    console.log('\n2. Testing results list...');
    const resultsResponse = await fetch(`${BASE_URL}/api/person/batch/results`);
    const resultsData = await resultsResponse.json();
    console.log('✅ Available Results:', JSON.stringify(resultsData, null, 2));

    // Test 3: Start batch processing
    console.log('\n3. Testing batch processing start...');
    const processResponse = await fetch(`${BASE_URL}/api/person/batch/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        minConfidence: 0.6,
        maxDetections: 5,
        outputResults: true
      })
    });

    const processData = await processResponse.json();
    console.log('✅ Process Start Response:', JSON.stringify(processData, null, 2));

    if (processData.success) {
      console.log('\n⏳ Batch processing started. Monitoring status...');
      
      // Monitor status for a few seconds
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const currentStatusResponse = await fetch(`${BASE_URL}/api/person/batch/status`);
        const currentStatusData = await currentStatusResponse.json();
        
        if (currentStatusData.success) {
          console.log(`📊 Status Check ${i + 1}:`, currentStatusData.status);
          
          if (!currentStatusData.status.isProcessing) {
            console.log('✅ Processing completed!');
            break;
          }
        }
      }

      // Test 4: Check results after processing
      console.log('\n4. Testing results after processing...');
      const finalResultsResponse = await fetch(`${BASE_URL}/api/person/batch/results`);
      const finalResultsData = await finalResultsResponse.json();
      console.log('✅ Final Results:', JSON.stringify(finalResultsData, null, 2));

      // Test 5: Download a result file if available
      if (finalResultsData.success && finalResultsData.results.length > 0) {
        console.log('\n5. Testing result file download...');
        const firstResult = finalResultsData.results[0];
        const downloadResponse = await fetch(`${BASE_URL}/api/person/batch/results/${firstResult.filename}`);
        const downloadData = await downloadResponse.json();
        
        if (downloadData.success) {
          console.log('✅ Download successful. Result summary:');
          console.log(`   📊 Total Images: ${downloadData.result.summary.totalImages}`);
          console.log(`   👥 Images with Persons: ${downloadData.result.summary.imagesWithPersons}`);
          console.log(`   🔢 Total Persons: ${downloadData.result.summary.personsDetected}`);
          console.log(`   ⏱️ Processing Time: ${downloadData.result.summary.processingTime}ms`);
          console.log(`   📈 Success Rate: ${downloadData.result.summary.successRate.toFixed(1)}%`);
          console.log(`   🎯 Detection Rate: ${downloadData.result.summary.detectionRate.toFixed(1)}%`);
        } else {
          console.log('⚠️ Download failed:', downloadData.error);
        }
      }
    }

    console.log('\n🎉 Batch Detection API tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test cancellation functionality
async function testCancellation() {
  console.log('\n🛑 Testing Cancellation Functionality...\n');
  
  try {
    // Start a batch process
    console.log('1. Starting batch process for cancellation test...');
    const processResponse = await fetch(`${BASE_URL}/api/person/batch/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        minConfidence: 0.5,
        maxDetections: 10,
        outputResults: true
      })
    });

    const processData = await processResponse.json();
    
    if (processData.success) {
      console.log('✅ Process started for cancellation test');
      
      // Wait a moment then cancel
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('2. Attempting to cancel...');
      const cancelResponse = await fetch(`${BASE_URL}/api/person/batch/cancel`, {
        method: 'POST'
      });

      const cancelData = await cancelResponse.json();
      console.log('✅ Cancel Response:', JSON.stringify(cancelData, null, 2));
      
      // Check status after cancellation
      await new Promise(resolve => setTimeout(resolve, 500));
      const statusResponse = await fetch(`${BASE_URL}/api/person/batch/status`);
      const statusData = await statusResponse.json();
      console.log('✅ Status After Cancel:', JSON.stringify(statusData, null, 2));
      
    } else {
      console.log('⚠️ Could not start process for cancellation test');
    }

  } catch (error) {
    console.error('❌ Cancellation test failed:', error.message);
  }
}

// Error handling tests
async function testErrorHandling() {
  console.log('\n🔧 Testing Error Handling...\n');
  
  try {
    // Test 1: Try to start when already running (if applicable)
    console.log('1. Testing duplicate start prevention...');
    
    // Start first process
    const firstResponse = await fetch(`${BASE_URL}/api/person/batch/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minConfidence: 0.6 })
    });
    
    const firstData = await firstResponse.json();
    
    if (firstData.success) {
      // Try to start second process immediately
      const secondResponse = await fetch(`${BASE_URL}/api/person/batch/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minConfidence: 0.6 })
      });
      
      const secondData = await secondResponse.json();
      
      if (!secondData.success && secondResponse.status === 409) {
        console.log('✅ Duplicate start prevention working correctly');
        console.log('   Response:', secondData.error);
      } else {
        console.log('⚠️ Duplicate start prevention may not be working');
      }
      
      // Cancel the first process
      await fetch(`${BASE_URL}/api/person/batch/cancel`, { method: 'POST' });
    }

    // Test 2: Invalid result file request
    console.log('\n2. Testing invalid result file request...');
    const invalidResponse = await fetch(`${BASE_URL}/api/person/batch/results/nonexistent-file.json`);
    
    if (invalidResponse.status === 404) {
      console.log('✅ Invalid file handling working correctly');
    } else {
      console.log('⚠️ Invalid file handling may need improvement');
    }

  } catch (error) {
    console.error('❌ Error handling test failed:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🚀 Batch Person Detection Test Suite\n');
  console.log('='.repeat(60));
  
  await testBatchDetectionAPI();
  await testCancellation();
  await testErrorHandling();
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ All tests completed!');
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    if (response.ok) {
      console.log('✅ Server is running');
      return true;
    }
  } catch (error) {
    console.log('❌ Server is not running. Please start the server first.');
    console.log(`   Expected server at: ${BASE_URL}`);
    return false;
  }
}

// Run tests
checkServer().then(isRunning => {
  if (isRunning) {
    main();
  } else {
    process.exit(1);
  }
});