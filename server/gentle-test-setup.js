import { CredentialManager } from './src/utils/credentialManager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== Gentle Camera Test Setup ===');
console.log('Setting up ultra-conservative configuration for testing...');

// Test only ONE camera first with minimal settings
const testCamera = {
  id: 'cam1',
  name: 'Front Door - TEST',
  rtspUrl: 'rtsp://192.168.31.62:554/stream1',
  username: '',
  password: '',
  frameRate: 1, // Ultra-low: 1 fps
  resolution: '320x240', // Ultra-low: 320x240
  nightMode: false,
  credentialId: 'camera_cam1'
};

try {
  // Write test configuration with only one camera
  fs.writeFileSync(path.join(__dirname, 'cameras.json'), JSON.stringify([testCamera], null, 2));
  console.log('✓ Created test config with 1 camera at 1fps, 320x240');
} catch (error) {
  console.error('Failed to create test config:', error);
}

// Update credentials with minimal settings
try {
  const cam1Cred = CredentialManager.getCredential('camera_cam1');
  
  if (cam1Cred) {
    CredentialManager.updateCredential('camera_cam1', {
      additionalData: {
        ...cam1Cred.additionalData,
        rtspUrl: 'rtsp://192.168.31.62:554/stream1',
        frameRate: 1,
        resolution: '320x240'
      }
    });
    console.log('✓ Updated credentials with ultra-conservative settings');
  }
} catch (error) {
  console.error('Failed to update credentials:', error);
}

console.log('');
console.log('Test Configuration:');
console.log('- Camera: Front Door (192.168.31.62)');
console.log('- Frame Rate: 1 fps (extremely low)');
console.log('- Resolution: 320x240 (very low)');
console.log('- Quality: Low');
console.log('- Timeout: 10 seconds');
console.log('');
console.log('Starting server in 3 seconds...');
console.log('Watch logs for gentle connection attempts...');