import { CredentialManager } from './src/utils/credentialManager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Fixing camera configuration to use test streams...');

// Update cameras.json to use test streams
const camerasFile = path.join(__dirname, 'cameras.json');
const cameras = [
  {
    id: 'cam1',
    name: 'Front Door',
    rtspUrl: 'test://stream',
    username: '',
    password: '',
    frameRate: 15,
    resolution: '1920x1080',
    nightMode: false,
    credentialId: null
  },
  {
    id: 'cam2',
    name: 'Back Door',
    rtspUrl: 'test://stream',
    username: '',
    password: '',
    frameRate: 15,
    resolution: '1920x1080',
    nightMode: false,
    credentialId: null
  }
];

try {
  fs.writeFileSync(camerasFile, JSON.stringify(cameras, null, 2));
  console.log('Updated cameras.json with test streams');
} catch (error) {
  console.error('Failed to update cameras.json:', error);
}

// Remove or update camera credentials to use test URLs
try {
  const cam1Cred = CredentialManager.getCredential('camera_cam1');
  const cam2Cred = CredentialManager.getCredential('camera_cam2');
  
  if (cam1Cred) {
    CredentialManager.updateCredential('camera_cam1', {
      additionalData: {
        ...cam1Cred.additionalData,
        rtspUrl: 'test://stream'
      }
    });
    console.log('Updated cam1 credential to use test stream');
  }
  
  if (cam2Cred) {
    CredentialManager.updateCredential('camera_cam2', {
      additionalData: {
        ...cam2Cred.additionalData,
        rtspUrl: 'test://stream'
      }
    });
    console.log('Updated cam2 credential to use test stream');
  }
  
  console.log('Camera configuration fixed successfully!');
} catch (error) {
  console.error('Failed to update credentials:', error);
}