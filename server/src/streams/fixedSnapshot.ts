import { spawn } from 'child_process';
import type { Camera } from './rtspManager.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import ffmpegStatic from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure snapshots directory exists
const snapshotsDir = path.join(__dirname, '../../public/snapshots');
if (!fs.existsSync(snapshotsDir)) {
  fs.mkdirSync(snapshotsDir, { recursive: true });
  console.log(`Created snapshots directory: ${snapshotsDir}`);
}

const ffmpegPath = ffmpegStatic as unknown as string;

export async function captureSnapshot(camera: Camera, targetResolution?: string): Promise<string | null> {
  if (!camera) {
    console.error('Cannot take snapshot: Camera not provided');
    return null;
  }

  return new Promise((resolve, reject) => {
    try {
      // Construct authentication part of URL if provided
      let rtspUrl = camera.rtspUrl;
      if (camera.username && camera.password) {
        const urlParts = camera.rtspUrl.split('://');
        if (urlParts.length === 2) {
          rtspUrl = `${urlParts[0]}://${camera.username}:${camera.password}@${urlParts[1]}`;
        }
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `snapshot_${camera.id}_${timestamp}.jpg`;
      const filepath = path.join(snapshotsDir, filename);

      // Prepare ffmpeg arguments for snapshot
      const ffmpegArgs = [
        '-rtsp_transport', 'tcp',
        '-timeout', '5000000',
        '-y', // Overwrite output file
        '-i', rtspUrl,
        ...(targetResolution ? ['-s', targetResolution] : []),
        '-frames:v', '1', // Capture single frame
        '-q:v', '2', // High quality
        filepath
      ];

      console.log(`Taking snapshot for camera ${camera.id} to ${filepath}`);
      const process = spawn(ffmpegPath, ffmpegArgs);

      let errorOutput = '';
      process.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 && fs.existsSync(filepath)) {
          resolve(`/snapshots/${filename}`);
        } else {
          console.error(`FFmpeg snapshot failed with code ${code}. Error: ${errorOutput}`);
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      process.on('error', (err) => {
        console.error('Failed to start FFmpeg:', err);
        reject(err);
      });

    } catch (error) {
      console.error('Error in snapshot capture:', error);
      reject(error);
    }
  });
}
