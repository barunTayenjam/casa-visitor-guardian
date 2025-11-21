#!/usr/bin/env node

console.log('Testing OpenCV with exact server import pattern...');

// Test with the exact same import pattern as the server
process.chdir('/Users/baruntayenjam/Code/home-security/server');

// Simulate the exact same environment as server
async function testServerPattern() {
  try {
    console.log('=== Testing exact server pattern ===');
    
    // This is exactly how the server imports it
    const opencvModule = await import('@techstark/opencv-js');
    const cv = opencvModule.default || opencvModule;
    
    console.log('1. CV object type:', typeof cv);
    console.log('2. Available keys:', Object.keys(cv).slice(0, 15));
    console.log('3. Mat available:', typeof cv.Mat);
    
    if (typeof cv.Mat === 'undefined') {
      console.log('4. Mat not available, waiting for initialization...');
      
      // Wait exactly like the server does
      let attempts = 0;
      const maxAttempts = 20;
      
      while (attempts < maxAttempts) {
        if (typeof cv.Mat !== 'undefined') {
          console.log(`5. Mat became available after ${attempts * 0.5} seconds!`);
          break;
        }
        
        console.log(`Waiting for initialization... (${attempts + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      // Verify that Mat is available
      if (typeof cv.Mat === 'undefined') {
        console.log('6. ERROR - OpenCV module failed to initialize properly');
        console.log('7. Available methods:', Object.keys(cv || {}).slice(0, 20));
        console.log('8. Module type:', typeof cv);
        
        // Check all properties including non-enumerable ones
        const allProps = Object.getOwnPropertyNames(cv);
        console.log('9. All property names:', allProps.slice(0, 20));
        console.log('10. All props count:', allProps.length);
        
        // Try to access any cv property that might be hidden
        for (let prop of allProps) {
          if (prop.toLowerCase().includes('mat')) {
            console.log(`11. Found Mat-related property: ${prop}`, typeof cv[prop]);
          }
        }
        
        return false;
      } else {
        console.log('12. Mat constructor is available, initialization successful');
        
        // Test creating a Mat to ensure it works
        try {
          const testMat = new cv.Mat();
          console.log('13. Mat created successfully, rows:', testMat.rows, 'cols:', testMat.cols);
          testMat.delete();
          console.log('14. Mat deleted successfully');
          return true;
        } catch (testError) {
          console.log('15. Mat creation test failed:', testError);
          return false;
        }
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Test multiple times to see if there's a caching issue
console.log('Test 1:');
const result1 = await testServerPattern();

console.log('\nTest 2 (immediately after):');
const result2 = await testServerPattern();

console.log(`\nResults: Test1=${result1}, Test2=${result2}`);

if (result1 && result2) {
  console.log('✓ OpenCV works correctly with server pattern!');
} else {
  console.log('✗ OpenCV fails with server pattern');
}