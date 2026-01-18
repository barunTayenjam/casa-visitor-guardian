import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { cacheService } from './cacheService.js';

interface PreviewOptions {
  fps?: number;
  resolution?: string;
  quality?: number;
}

const PREVIEW_DIR = process.env.PREVIEW_DIR || '/data/previews';
const DEFAULT_OPTIONS: PreviewOptions = {
  fps: 1,
  resolution: '320:-2',
  quality: 28,
};
const CACHE_TTL = 3600;

export class PreviewService {
  constructor(private readonly timelineService: { getActiveObjects: (camera: string) => Promise<Map<string, { label: string; lastSeen: Date; score: number }>> }) {}

  async generatePreview(segmentId: string, camera: string, options: PreviewOptions = {}): Promise<string> {
    const { fps, resolution, quality } = { ...DEFAULT_OPTIONS, ...options };
    const outputDir = path.join(PREVIEW_DIR, camera);
    const outputPath = path.join(outputDir, `${segmentId}.mp4`);

    await fs.mkdir(outputDir, { recursive: true });

    const exists = await this.fileExists(outputPath);
    if (exists) return outputPath;

    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-y',
        '-f', 'rtsp',
        '-i', `rtsp://localhost:8554/${camera}`,
        '-vf', `fps=${fps},scale=${resolution},eq=saturation=0.7`,
        '-c:v', 'libx264',
        '-crf', String(quality),
        '-preset', 'ultrafast',
        '-tune', 'fastdecode',
        '-movflags', '+faststart',
        '-t', '60',
        outputPath,
      ];

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      let errorOutput = '';

      ffmpeg.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      ffmpeg.on('close', (code: number) => {
        if (code === 0) {
          console.log(`Preview generated: ${outputPath}`);
          resolve(outputPath);
        } else {
          if (errorOutput.includes('404') || errorOutput.includes('Invalid')) {
            this.generateFallbackPreview(segmentId, camera, outputPath)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error(`FFmpeg failed: ${errorOutput.substring(0, 200)}`));
          }
        }
      });

      ffmpeg.on('error', (err: Error) => {
        reject(err);
      });

      setTimeout(() => {
        ffmpeg.kill();
        this.generateFallbackPreview(segmentId, camera, outputPath)
          .then(resolve)
          .catch(reject);
      }, 60000);
    });
  }

  private async generateFallbackPreview(segmentId: string, camera: string, outputPath: string): Promise<string> {
    const thumbPath = path.join(PREVIEW_DIR, camera, `${segmentId}_thumb.jpg`);
    const tempPath = path.join(PREVIEW_DIR, camera, `${segmentId}_temp.mp4`);

    try {
      await this.captureThumbnail(camera, thumbPath);
      await fs.writeFile(tempPath, Buffer.from([]));
      await fs.rename(tempPath, outputPath);
      return outputPath;
    } catch (err) {
      console.error(`Fallback preview failed: ${err}`);
      await fs.writeFile(outputPath, Buffer.from([]));
      return outputPath;
    }
  }

  private async captureThumbnail(camera: string, outputPath: string): Promise<void> {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-f', 'rtsp',
        '-i', `rtsp://localhost:8554/${camera}`,
        '-vf', 'scale=320:-2',
        '-vframes', '1',
        '-q:v', '2',
        outputPath,
      ]);

      ffmpeg.on('close', () => resolve());
      ffmpeg.on('error', () => resolve());
      setTimeout(() => {
        ffmpeg.kill();
        resolve();
      }, 10000);
    });
  }

  async getPreviewStream(segmentId: string, camera: string): Promise<Buffer | null> {
    const previewPath = path.join(PREVIEW_DIR, camera, `${segmentId}.mp4`);
    const cacheKey = `preview:${segmentId}`;

    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) return Buffer.from(cached, 'base64');

      const exists = await this.fileExists(previewPath);
      if (!exists) {
        await this.generatePreview(segmentId, camera);
      }

      const content = await fs.readFile(previewPath);
      await cacheService.set(cacheKey, content.toString('base64'), CACHE_TTL);
      return content;
    } catch (err) {
      console.error(`Preview stream error: ${err}`);
      return null;
    }
  }

  async getThumbnailPath(segmentId: string, camera: string): Promise<string | null> {
    const thumbPath = path.join(PREVIEW_DIR, camera, `${segmentId}_thumb.jpg`);
    const previewPath = path.join(PREVIEW_DIR, camera, `${segmentId}.mp4`);

    try {
      const thumbExists = await this.fileExists(thumbPath);
      if (thumbExists) return thumbPath;

      const previewExists = await this.fileExists(previewPath);
      if (!previewExists) {
        await this.generatePreview(segmentId, camera);
      }

      await this.extractThumbnailFromVideo(previewPath, thumbPath);
      return thumbPath;
    } catch (err) {
      console.error(`Thumbnail path error: ${err}`);
      return null;
    }
  }

  private async extractThumbnailFromVideo(videoPath: string, thumbPath: string): Promise<void> {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', videoPath,
        '-vf', 'scale=320:-2',
        '-vframes', '1',
        '-q:v', '2',
        thumbPath,
      ]);

      ffmpeg.on('close', () => resolve());
      ffmpeg.on('error', () => resolve());
      setTimeout(() => {
        ffmpeg.kill();
        resolve();
      }, 10000);
    });
  }

  async cleanupPreviews(camera: string, olderThan: Date): Promise<number> {
    let count = 0;
    const cameraDir = path.join(PREVIEW_DIR, camera);

    try {
      const files = await fs.readdir(cameraDir);
      for (const file of files) {
        const filePath = path.join(cameraDir, file);
        const stat = await fs.stat(filePath);
        if (stat.mtime < olderThan && (file.endsWith('.mp4') || file.endsWith('.jpg'))) {
          await fs.unlink(filePath);
          count++;
        }
      }
    } catch (err) {
      console.error(`Preview cleanup error: ${err}`);
    }

    return count;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      const stat = await fs.stat(filePath);
      return stat.size > 0;
    } catch {
      return false;
    }
  }
}
