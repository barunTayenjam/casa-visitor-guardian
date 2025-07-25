import * as fs from 'fs';
import * as path from 'path';
import { generateTestJpegFrame } from './testImageGenerator.js';

const snapshotsDir = path.join(__dirname, '../../public/snapshots');
const cameraId = 'test-camera';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const filename = `snapshot_${cameraId}_${timestamp}.jpg`;
const filepath = path.join(snapshotsDir, filename);

if (!fs.existsSync(snapshotsDir)) {
  fs.mkdirSync(snapshotsDir, { recursive: true });
}

const imageBuffer = generateTestJpegFrame(cameraId);
fs.writeFileSync(filepath, imageBuffer);

console.log(`Test snapshot created at: ${filepath}`);
