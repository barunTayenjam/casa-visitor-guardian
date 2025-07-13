#!/usr/bin/env node

/**
 * Test script for person detection functionality
 * This script tests various aspects of the person detection system
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001'; // Adjust port as needed
const TEST_CAMERA_ID = 'test-camera-1';

async function testPersonDetectionAPI() {
  console.log('🧪 Testing Person Detection API...\n');

  try {
    // Test 1: Get system stats
    console.log('1. Testing system stats...');
    const systemStatsResponse = await fetch(`${BASE_URL}/api/person/system/stats`);
    const systemStats = await systemStatsResponse.json();
    console.log('✅ System Stats:', JSON.stringify(systemStats, null, 2));

    // Test 2: Get camera settings
    console.log('\n2. Testing camera settings...');
    const settingsResponse = await fetch(`${BASE_URL}/api/person/${TEST_CAMERA_ID}/settings`);
    if (settingsResponse.ok) {
      const settings = await settingsResponse.json();
      console.log('✅ Camera Settings:', JSON.stringify(settings, null, 2));
    } else {
      console.log('⚠️ Camera not found (expected for test)');
    }

    // Test 3: Update camera settings
    console.log('\n3. Testing settings update...');
    const updateResponse = await fetch(`${BASE_URL}/api/person/${TEST_CAMERA_ID}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        minConfidence: 0.7,
        cooldownPeriod: 5000,
        maxDetections: 5,
        enableBoundingBoxes: true,
        enableZoneDetection: false
      })
    });
    
    if (updateResponse.ok) {
      console.log('✅ Settings updated successfully');
    } else {
      console.log('⚠️ Settings update failed (expected if camera not configured)');
    }

    // Test 4: Get camera stats
    console.log('\n4. Testing camera stats...');
    const statsResponse = await fetch(`${BASE_URL}/api/person/${TEST_CAMERA_ID}/stats`);
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ Camera Stats:', JSON.stringify(stats, null, 2));
    } else {
      console.log('⚠️ Camera stats not available');
    }

    // Test 5: Test detection zones
    console.log('\n5. Testing detection zones...');
    
    // Add a test zone
    const zoneResponse = await fetch(`${BASE_URL}/api/person/${TEST_CAMERA_ID}/zones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'test-zone-1',
        name: 'Front Door Area',
        points: [
          { x: 0.2, y: 0.2 },
          { x: 0.8, y: 0.2 },
          { x: 0.8, y: 0.8 },
          { x: 0.2, y: 0.8 }
        ],
        enabled: true
      })
    });

    if (zoneResponse.ok) {
      console.log('✅ Detection zone added successfully');
      
      // Get zones
      const getZonesResponse = await fetch(`${BASE_URL}/api/person/${TEST_CAMERA_ID}/zones`);
      if (getZonesResponse.ok) {
        const zones = await getZonesResponse.json();
        console.log('✅ Detection Zones:', JSON.stringify(zones, null, 2));
      }
    } else {
      console.log('⚠️ Zone creation failed');
    }

    // Test 6: Reset metrics
    console.log('\n6. Testing metrics reset...');
    const resetResponse = await fetch(`${BASE_URL}/api/person/system/reset-metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (resetResponse.ok) {
      const resetResult = await resetResponse.json();
      console.log('✅ Metrics Reset:', resetResult.message);
    } else {
      console.log('⚠️ Metrics reset failed');
    }

    console.log('\n🎉 Person Detection API tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Performance test
async function performanceTest() {
  console.log('\n⚡ Running Performance Test...\n');
  
  const startTime = Date.now();
  const requests = [];
  
  // Make multiple concurrent requests to test system load
  for (let i = 0; i < 10; i++) {
    requests.push(
      fetch(`${BASE_URL}/api/person/system/stats`)
        .then(r => r.json())
        .catch(e => ({ error: e.message }))
    );
  }
  
  const results = await Promise.all(requests);
  const endTime = Date.now();
  
  const successCount = results.filter(r => !r.error).length;
  const errorCount = results.filter(r => r.error).length;
  
  console.log(`📊 Performance Results:`);
  console.log(`   Total requests: 10`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${errorCount}`);
  console.log(`   Total time: ${endTime - startTime}ms`);
  console.log(`   Average time per request: ${(endTime - startTime) / 10}ms`);
}

// Main execution
async function main() {
  console.log('🚀 Person Detection Test Suite\n');
  console.log('='.repeat(50));
  
  await testPersonDetectionAPI();
  await performanceTest();
  
  console.log('\n' + '='.repeat(50));
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