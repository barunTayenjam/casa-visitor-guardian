/**
 * Test script to verify detection readiness API endpoint
 */
async function testDetectionReadiness() {
  console.log('Testing detection readiness API endpoint...');

  try {
    // Test the endpoint directly (assuming server is running on port 8082)
    const response = await fetch('http://localhost:8082/api/system/detection-ready');
    const result = await response.json();

    console.log('Detection readiness result:', result);

    if (result.success) {
      console.log('✓ API endpoint exists and returns valid response');
      console.log('  - Object Detection Ready:', result.objectDetectionReady);
      console.log('  - Facial Recognition Ready:', result.facialRecognitionReady);
      console.log('  - All Services Ready:', result.allReady);

      if (result.allReady) {
        console.log('✓ All detection services are ready!');
        console.log('You can now run classification jobs.');
      } else {
        console.log('⚠ Detection services are not ready yet.');
        console.log('Please wait for services to initialize before running classification jobs.');
      }
    } else {
      console.log('✗ API endpoint returned error:', result.error);
    }

    return result;
  } catch (error) {
    console.error('✗ Error testing detection readiness API:', error.message);
    console.log('Make sure the backend server is running on port 8082');
    return null;
  }
}

// Also test the event images endpoint
async function testEventImagesEndpoint() {
  console.log('\nTesting event images API endpoint...');

  try {
    const response = await fetch('http://localhost:8082/api/events/images');
    const result = await response.json();

    console.log('Event images result:', result);

    if (result.success) {
      console.log('✓ Event images endpoint works');
      console.log('  - Total images found:', result.total);
      console.log('  - First few images:', result.images.slice(0, 3).map(img => img.filename));
    } else {
      console.log('✗ Event images endpoint returned error:', result.error);
    }

    return result;
  } catch (error) {
    console.error('✗ Error testing event images API:', error.message);
    return null;
  }
}

// Poll for service readiness until they're ready
async function waitForServicesReady() {
  console.log('\nWaiting for detection services to become ready...');
  console.log('(This may take several minutes during initial startup)\n');

  let checks = 0;
  const maxChecks = 60; // Check for up to 15 minutes (60 checks * 15 seconds = 15 min)

  while (checks < maxChecks) {
    const result = await testDetectionReadiness();

    if (result && result.allReady) {
      console.log('\n🎉 SUCCESS: All detection services are now ready!');
      console.log('You can now use the classification functionality.');
      return true;
    } else if (result) {
      console.log(`Waiting... (${checks + 1}/${maxChecks}) Next check in 15 seconds\n`);
    }

    checks++;

    // Wait 15 seconds before next check (to avoid rate limiting)
    await new Promise(resolve => setTimeout(resolve, 15000));
  }

  console.log('\n⚠️  WARNING: Services did not become ready within the expected time.');
  console.log('This could be due to:');
  console.log('  - Large model files still loading');
  console.log('  - Insufficient system resources');
  console.log('  - Missing model files in server/models directory');
  console.log('  - Backend server still initializing');
  console.log('\nPlease check the backend server logs for more details.');

  return false;
}

// Run tests
console.log('Starting detection API tests...\n');
testDetectionReadiness().then(async (result) => {
  await testEventImagesEndpoint();

  // If services aren't ready, start waiting for them
  if (result && !result.allReady) {
    await waitForServicesReady();
  } else if (result && result.allReady) {
    console.log('\nAll services are already ready!');
  }
});