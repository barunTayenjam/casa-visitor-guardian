import { analyzeImage } from './src/services/nvidia/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const imagePath = '/home/barun/Documents/home-security-non-docker/data/detections/2026-06/events/motion/motion_cam1_2026-06-04T22-31-49-126Z.jpg';
const outFile = '/home/barun/Documents/home-security-non-docker/server/nvidia-result.json';

console.log('Testing with image:', imagePath);

try {
  const result = await analyzeImage(imagePath, { cameraName: 'TestCam' });
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log('✅ Result written to', outFile);
} catch (error) {
  console.error('Test Error:', error);
}
