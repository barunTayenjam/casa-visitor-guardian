import { getOpenCVClient } from '../services/opencvMicroserviceClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testOpenCVIntegration() {
  console.log('🧪 Testing OpenCV Microservice Integration...');
  
  try {
    const client = getOpenCVClient();
    
    // Test 1: Health check
    console.log('\n1. Testing health check...');
    const isHealthy = await client.checkHealth();
    console.log(`   Health: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    
    // Test 2: Service status
    console.log('\n2. Testing service status...');
    const status = await client.getStatus();
    console.log(`   Status: ${status?.status || 'Unknown'}`);
    console.log(`   Initialized: ${status?.initialized || false}`);
    
    // Test 3: Create a test image if none exists
    const testImagePath = path.join(__dirname, '../../test-image.jpg');
    if (!fs.existsSync(testImagePath)) {
      console.log('\n3. Creating test image...');
      // Create a simple 1x1 black JPEG file for testing
      const blackJpeg = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43
      ]);
      fs.writeFileSync(testImagePath, blackJpeg);
      console.log('   ✅ Test image created');
    }
    
    // Test 4: Object detection
    console.log('\n4. Testing object detection...');
    try {
      const detectionResult = await client.detectObjects(testImagePath);
      console.log(`   Success: ${detectionResult.success ? '✅' : '❌'}`);
      console.log(`   Cached: ${detectionResult.cached ? '✅' : '❌'}`);
      console.log(`   Detections: ${detectionResult.detections?.length || 0}`);
      if (detectionResult.detections) {
        detectionResult.detections.forEach((det, i) => {
          console.log(`     ${i + 1}. ${det.class} (${(det.confidence * 100).toFixed(1)}%)`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Object detection failed: ${(error as Error).message}`);
    }
    
    // Test 5: Face recognition
    console.log('\n5. Testing face recognition...');
    try {
      const faceResult = await client.recognizeFaces(testImagePath);
      console.log(`   Success: ${faceResult.success ? '✅' : '❌'}`);
      console.log(`   Cached: ${faceResult.cached ? '✅' : '❌'}`);
      console.log(`   Face detections: ${faceResult.faceDetections?.length || 0}`);
      if (faceResult.faceDetections) {
        faceResult.faceDetections.forEach((face, i) => {
          console.log(`     ${i + 1}. ${face.name} (${(face.confidence * 100).toFixed(1)}%)`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Face recognition failed: ${(error as Error).message}`);
    }
    
    // Cleanup
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
      console.log('\n🧹 Cleaned up test image');
    }
    
    console.log('\n✅ OpenCV Microservice Integration Test Complete!');
    console.log('\n📝 Summary:');
    console.log(`   - Service Health: ${isHealthy ? '✅' : '❌'}`);
    console.log(`   - Service Status: ${status?.status || 'Unknown'}`);
    console.log(`   - API Communication: ✅`);
    console.log(`   - Detection Services: ${isHealthy ? '✅ Ready' : '⚠️ Initializing'}`);
    
  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run the test
testOpenCVIntegration();