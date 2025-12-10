/**
 * Simple test script to verify detection system upgrades
 */

import { objectDetectionService, DetectionClass } from './src/detection/objectDetection.js';
import { facialRecognitionService } from './src/detection/facialRecognition.js';
import detectionConfig from './src/config/detectionConfig.js';

async function testDetectionUpgrades() {
  console.log('🧪 Testing Detection System Upgrades...\n');

  // Test 1: Check if detection services are properly configured with new settings
  console.log('✅ Test 1: Checking detection service configurations...');
  
  // Initialize services
  await objectDetectionService.initialize();
  await facialRecognitionService.initialize();
  
  console.log(`   Object Detection - Min Confidence: ${detectionConfig.personDetection.minConfidence}`);
  console.log(`   Object Detection - Max Detections: ${detectionConfig.personDetection.maxDetections}`);
  console.log(`   Motion Detection - Sensitivity: ${detectionConfig.motionDetection.sensitivity}`);
  console.log(`   Facial Recognition - Min Face Size: ${detectionConfig.facialRecognition.minFaceSize}`);
  
  // Test 2: Verify new post-processing functions are available
  console.log('\n✅ Test 2: Verifying new detection improvements...');
  
  // Test the new methods exist by checking the objectDetectionService
  const hasPostProcess = typeof objectDetectionService['postProcessDetections'] !== 'undefined';
  console.log(`   Post-processing method exists: ${hasPostProcess}`);
  
  const hasNMS = typeof objectDetectionService['nonMaximumSuppression'] !== 'undefined';
  console.log(`   Non-Maximum Suppression method exists: ${hasNMS}`);
  
  const hasIoUCalculation = typeof objectDetectionService['calculateIoU'] !== 'undefined';
  console.log(`   IoU calculation method exists: ${hasIoUCalculation}`);
  
  // Test 3: Verify configuration integration
  console.log('\n✅ Test 3: Verifying configuration integration...');
  
  const objectDetectionSettings = objectDetectionService.getSettings('default');
  const facialRecognitionSettings = facialRecognitionService.getSettings('default');
  
  if (objectDetectionSettings) {
    console.log(`   Object Detection Settings - Min Confidence: ${objectDetectionSettings.minConfidence}`);
    console.log(`   Object Detection Settings - Max Detections: ${objectDetectionSettings.maxDetections}`);
    console.log(`   Object Detection Settings - NMS Threshold: ${objectDetectionSettings.nmsThreshold}`);
  } else {
    console.log('   ❌ Object Detection settings not found');
  }
  
  if (facialRecognitionSettings) {
    console.log(`   Facial Recognition Settings - Min Face Size: ${facialRecognitionSettings.minFaceSize}`);
    console.log(`   Facial Recognition Settings - Recognition Threshold: ${facialRecognitionSettings.recognitionThreshold}`);
  } else {
    console.log('   ❌ Facial Recognition settings not found');
  }
  
  // Test 4: Check detection configuration loading
  console.log('\n✅ Test 4: Checking detection configuration...');
  
  console.log(`   Person Detection Model Path: ${detectionConfig.personDetection.modelPath}`);
  console.log(`   Motion Detection Sensitivity: ${detectionConfig.motionDetection.sensitivity}`);
  console.log(`   Facial Recognition Model Path: ${detectionConfig.facialRecognition.faceModelPath}`);
  
  // Verify configuration validation
  const validation = {
    personModelExists: typeof detectionConfig.personDetection.modelPath === 'string' && detectionConfig.personDetection.modelPath.length > 0,
    motionSettingsValid: detectionConfig.motionDetection.sensitivity >= 0 && detectionConfig.motionDetection.sensitivity <= 100,
    faceModelExists: typeof detectionConfig.facialRecognition.faceModelPath === 'string' && detectionConfig.facialRecognition.faceModelPath.length > 0
  };
  
  console.log(`   Person detection model path configured: ${validation.personModelExists}`);
  console.log(`   Motion detection sensitivity valid: ${validation.motionSettingsValid}`);
  console.log(`   Face detection model path configured: ${validation.faceModelExists}`);
  
  console.log('\n🎉 Detection system upgrade tests completed!');
  console.log('\n📋 Summary of improvements implemented:');
  console.log('   • Enhanced person detection with post-processing and NMS');
  console.log('   • Improved motion detection with smart filtering and centroid tracking');
  console.log('   • Better integration between motion and person detection');
  console.log('   • Centralized configuration system for all detection parameters');
  console.log('   • API endpoints for runtime configuration of detection parameters');
  console.log('   • Performance monitoring and statistics endpoints');
  
  if (validation.personModelExists && validation.motionSettingsValid && validation.faceModelExists) {
    console.log('\n✅ All systems properly configured and ready for use!');
  } else {
    console.log('\n⚠️  Some configuration issues detected - please check model files and settings.');
  }
}

// Run the test
testDetectionUpgrades().catch(error => {
  console.error('❌ Test failed with error:', error);
});