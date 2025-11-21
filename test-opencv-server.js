#!/usr/bin/env node

console.log('Testing OpenCV in server context...');

// Test with the same working directory and environment as the server
process.chdir('/Users/baruntayenjam/Code/home-security/server');

async function testOpenCV() {
  try {
    console.log('1. Importing @techstark/opencv-js...');
    const opencvModule = await import('@techstark/opencv-js');
    console.log('2. Module imported successfully');
    console.log('   - Default type:', typeof opencvModule.default);
    console.log('   - Has default:', !!opencvModule.default);
    
    const cv = opencvModule.default || opencvModule;
    console.log('3. CV object type:', typeof cv);
    console.log('4. Available keys:', Object.keys(cv).slice(0, 15));
    console.log('5. Mat available:', typeof cv.Mat);
    
    if (typeof cv.Mat === 'undefined') {
      console.log('6. Mat not available, waiting for initialization...');
      
      // Wait for initialization
      let attempts = 0;
      while (attempts < 20) {
        if (typeof cv.Mat !== 'undefined') {
          console.log(`7. Mat became available after ${attempts * 0.5} seconds!`);
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      if (typeof cv.Mat === 'undefined') {
        console.log('8. Mat still not available after waiting');
        console.log('   Available keys after waiting:', Object.keys(cv).slice(0, 20));
        console.log('   All keys count:', Object.keys(cv).length);
        
        // Check if there are any hidden properties
        const allProps = Object.getOwnPropertyNames(cv);
        console.log('   All property names:', allProps.slice(0, 20));
        console.log('   All props count:', allProps.length);
      }
    }
    
    if (typeof cv.Mat !== 'undefined') {
      console.log('9. Testing Mat creation...');
      try {
        const testMat = new cv.Mat();
        console.log('10. Mat created successfully, rows:', testMat.rows, 'cols:', testMat.cols);
        testMat.delete();
        console.log('11. Mat deleted successfully');
        console.log('✓ OpenCV is working correctly!');
      } catch (error) {
        console.log('✗ Mat creation failed:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testOpenCV();