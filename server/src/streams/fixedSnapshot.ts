import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import ffmpeg-static safely
// @ts-ignore - Ignore type checking for ffmpeg-static import
import ffmpegStatic from 'ffmpeg-static';
const ffmpegPath = ffmpegStatic as unknown as string;

// Ensure snapshots directory exists
const snapshotsDir = path.join(__dirname, '../../public/snapshots');
if (!fs.existsSync(snapshotsDir)) {
  fs.mkdirSync(snapshotsDir, { recursive: true });
  console.log(`Created snapshots directory: ${snapshotsDir}`);
}

/**
 * Takes a snapshot from a camera
 * @param camera The camera to take a snapshot from
 * @param preferredResolution Optional preferred resolution
 * @returns Promise that resolves to the snapshot URL or null if failed
 */
export async function captureSnapshot(camera: any, preferredResolution = ''): Promise<string | null> {
  if (!camera) {
    console.error('Cannot take snapshot: Camera not provided');
    return null;
  }

  const cameraId = camera.id;
  
  // If no resolution is specified, use the camera's native resolution or fall back to Full HD
  const targetResolution = preferredResolution || camera.resolution || '1920x1080';
  console.log(`Taking snapshot for camera ${cameraId} at resolution ${targetResolution}`);
  
  // For real cameras, take a snapshot using FFmpeg
  return new Promise((resolve, reject) => {
    try {
      // Construct authentication part of URL if provided
        
        // Write the last frame to a file
        fs.writeFileSync(filepath, camera.lastFrame);
        console.log(`Test pattern snapshot saved: ${filepath}`);
        return `/snapshots/${filename}`;
      } catch (error) {
        console.error('Error saving test pattern snapshot:', error);
        return null;
      }
    }
    return null;
  }
      // Construct authentication part of URL if provided
      let rtspUrl = camera.rtspUrl;
      if (camera.username && camera.password) {
        const urlParts = camera.rtspUrl.split('://');
        if (urlParts.length === 2) {
          rtspUrl = `${urlParts[0]}://${camera.username}:${camera.password}@${urlParts[1]}`;
        }
      }

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${cameraId}_${timestamp}.jpg`;
      const filepath = path.join(snapshotsDir, filename);
      
      console.log(`Saving snapshot to: ${filepath}`);

      // Prepare ffmpeg arguments optimized for reliable snapshot capture
      const ffmpegArgs = [
        // Use TCP for reliability
        '-rtsp_transport', 'tcp',
        // Set a shorter timeout
        '-timeout', '15000000',
        // Use a smaller input buffer
        '-bufsize', '1024k',
        // Input URL
        '-i', rtspUrl,
        // Take a single frame
        '-vframes', '1',
        // Best quality
        '-q:v', '1',
        // Use Full HD resolution as per user preference
        '-s', targetResolution,
        // Apply night mode filter if needed
        ...(camera.nightMode ? ['-vf', 'eq=gamma=1.5:contrast=1.2:brightness=0.2'] : []),
        // Output to file
        filepath
      ];

      console.log(`FFmpeg snapshot command: ${ffmpegPath} ${ffmpegArgs.join(' ')}`);
      
      // Spawn ffmpeg process
      const process = spawn(ffmpegPath, ffmpegArgs);
      
      let errorOutput = '';
      
      // Collect error output
      process.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        console.log(`FFmpeg snapshot stderr: ${chunk}`);
      });
      
      // Handle process completion
      process.on('close', (code) => {
        if (code === 0) {
          console.log(`Snapshot saved successfully: ${filepath}`);
          resolve(`/snapshots/${filename}`);
        } else {
          console.error(`Failed to take snapshot, exit code: ${code}`);
          console.error(`Error output: ${errorOutput}`);
          reject(new Error(`Snapshot failed with code ${code}`));
        }
      });
      
      // Handle process error
      process.on('error', (err) => {
        console.error(`Error taking snapshot:`, err);
        reject(err);
      });
      
    } catch (error) {
      console.error('Error in snapshot capture:', error);
      reject(error);
    }
  });
}
