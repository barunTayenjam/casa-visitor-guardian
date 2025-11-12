import { CredentialManager } from './src/utils/credentialManager.js';

console.log('=== Resetting Camera Credentials ===');

// Clear existing corrupted credentials
try {
  console.log('Clearing corrupted credentials...');
  // We'll add fresh credentials
} catch (error) {
  console.log('No credentials to clear:', error.message);
}

// Add fresh credentials for both cameras
console.log('\nAdding fresh credentials...');

try {
  CredentialManager.addCredential({
    id: 'camera_cam1',
    type: 'camera',
    name: 'Front Door Camera',
    username: 'barun.2009.tam@gmail.com',
    password: 'mezmu2-xewwyn-geJtiv'
  });
  console.log('✓ Added credentials for cam1 (Front Door)');
} catch (error) {
  console.log('✗ Failed to add cam1 credentials:', error.message);
}

try {
  CredentialManager.addCredential({
    id: 'camera_cam2',
    type: 'camera',
    name: 'Back Door Camera',
    username: 'barun.2009.tam@gmail.com',
    password: 'mezmu2-xewwyn-geJtiv'
  });
  console.log('✓ Added credentials for cam2 (Back Door)');
} catch (error) {
  console.log('✗ Failed to add cam2 credentials:', error.message);
}

// Verify credentials were added
console.log('\nVerifying credentials...');
const cam1Cred = CredentialManager.getCredential('camera_cam1');
const cam2Cred = CredentialManager.getCredential('camera_cam2');

console.log('cam1 credential:', cam1Cred ? '✓ Found' : '✗ Not found');
console.log('cam2 credential:', cam2Cred ? '✓ Found' : '✗ Not found');

if (cam1Cred) {
  console.log('cam1 username:', cam1Cred.username);
}
if (cam2Cred) {
  console.log('cam2 username:', cam2Cred.username);
}

console.log('\n=== Credentials Reset Complete ===');
console.log('Now restart server to test with proper authentication');