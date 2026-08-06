import { logger } from '../../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { serviceRegistry } from '../serviceRegistry.js';

const SAMPLE_INTERVAL_MS = 30 * 1000;
const TARGET_SECONDS = 120;
const OUTPUT_FPS = 24;
const RAW_SUBDIR = 'raw';

export interface FrameProvider {
  getCameraIds(): string[];
  getFrame(cameraId: string): Buffer | null;
}

class StreamManagerFrameProvider implements FrameProvider {
  getCameraIds(): string[] {
    try {
      const sm = serviceRegistry.getStreamManager();
      return sm.getAllCameras().map((c: { id: string }) => c.id).filter(Boolean);
    } catch {
      return [];
    }
  }
  getFrame(cameraId: string): Buffer | null {
    try {
      return serviceRegistry.getStreamManager().getLastFrame(cameraId);
    } catch {
      return null;
    }
  }
}

export class TimelapseService {
  private readonly TIMELAPSE_DIR = process.env.TIMELAPSE_DIR || path.join(process.cwd(), 'public', 'timelapse');
  private sampleTimer: NodeJS.Timeout | null = null;
  private readonly provider: FrameProvider;

  constructor(provider: FrameProvider = new StreamManagerFrameProvider()) {
    this.provider = provider;
    this.ensureDir();
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.TIMELAPSE_DIR, { recursive: true });
    } catch (err) {
      logger.error(`Failed to create timelapse dir: ${err}`, 'TimelapseService');
    }
  }

  private getDateString(date = new Date()): string {
    return date.toISOString().split('T')[0];
  }

  private getFinalPath(cameraId: string, date: string): string {
    return path.join(this.TIMELAPSE_DIR, cameraId, `${date}.mp4`);
  }

  private getRawDir(cameraId: string, date = this.getDateString()): string {
    return path.join(this.TIMELAPSE_DIR, cameraId, RAW_SUBDIR, date);
  }

  // ── Live sampling ──

  startSampler(): void {
    if (this.sampleTimer) return;
    this.sampleTimer = setInterval(() => { this.sampleOnce().catch((err: unknown) => {
      logger.error('Timelapse sampler interval sample failed', 'TimelapseService', err);
    }); }, SAMPLE_INTERVAL_MS);
    logger.info(`Timelapse sampler started (every ${SAMPLE_INTERVAL_MS / 1000}s)`, 'TimelapseService');
    this.sampleOnce().catch((err: unknown) => {
      logger.error('Initial timelapse sample failed', 'TimelapseService', err);
    });
  }

  stopSampler(): void {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
      logger.info('Timelapse sampler stopped', 'TimelapseService');
    }
  }

  private async sampleOnce(): Promise<void> {
    const date = this.getDateString();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    for (const cameraId of this.provider.getCameraIds()) {
      const frame = this.provider.getFrame(cameraId);
      if (!frame || frame.length === 0) continue;
      try {
        const dir = this.getRawDir(cameraId, date);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, `${stamp}.jpg`), frame);
      } catch (err) {
        logger.debug(`Failed to write timelapse sample for ${cameraId}: ${err}`, 'TimelapseService');
      }
    }
  }

  // ── Querying ──

  async hasTimelapse(cameraId: string, date: string): Promise<boolean> {
    try {
      await fs.access(this.getFinalPath(cameraId, date));
      return true;
    } catch {
      return false;
    }
  }

  async listTimelapsesForDate(date: string): Promise<{ cameraId: string; path: string }[]> {
    const results: { cameraId: string; path: string }[] = [];
    try {
      const cameraDirs = await fs.readdir(this.TIMELAPSE_DIR);
      for (const cameraId of cameraDirs) {
        try {
          await fs.access(this.getFinalPath(cameraId, date));
          results.push({ cameraId, path: `/timelapse/${cameraId}/${date}.mp4` });
        } catch {
          // not found
        }
      }
    } catch {
      // no dir
    }
    return results;
  }

  getActiveCameras(): string[] {
    return this.provider.getCameraIds();
  }

  isSamplerRunning(): boolean {
    return this.sampleTimer !== null;
  }

  // ── Stitching ──

  /** Count raw JPEGs available for a camera/date */
  async getRawCount(cameraId: string, date: string): Promise<number> {
    try {
      const files = await fs.readdir(this.getRawDir(cameraId, date));
      return files.filter((f) => f.endsWith('.jpg')).length;
    } catch {
      return 0;
    }
  }

  /** Delete raw JPEGs for a camera/date after stitching */
  async deleteRaws(cameraId: string, date: string): Promise<number> {
    const dir = this.getRawDir(cameraId, date);
    try {
      const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.jpg'));
      await Promise.all(files.map((f) => fs.unlink(path.join(dir, f)).catch((err: unknown) => {
        logger.warn(`Failed to delete raw JPEG ${f}`, 'TimelapseService', { error: err instanceof Error ? err.message : String(err) });
      })));
      await fs.rmdir(dir).catch((err: unknown) => {
        logger.warn(`Failed to remove raw dir ${dir}`, 'TimelapseService', { error: err instanceof Error ? err.message : String(err) });
      });
      return files.length;
    } catch {
      return 0;
    }
  }

  /** Stitch a date's raw JPEGs (sorted by filename = chronological) into the final MP4. */
  async stitchFromRaw(cameraId: string, date: string, deleteRaws = true): Promise<{ count: number; path: string; deleted: number }> {
    const dir = this.getRawDir(cameraId, date);
    let files: string[] = [];
    try {
      files = (await fs.readdir(dir)).filter((f) => f.endsWith('.jpg')).sort();
    } catch {
      throw new Error(`No raw frames for ${cameraId} on ${date}`);
    }
    if (files.length === 0) {
      throw new Error(`No raw frames for ${cameraId} on ${date}`);
    }

    const validPaths: string[] = [];
    for (const f of files) {
      const p = path.join(dir, f);
      try {
        const stat = await fs.stat(p);
        if (stat.size > 0) validPaths.push(p);
      } catch {
        // skip missing
      }
    }
    if (validPaths.length === 0) {
      throw new Error(`All raw frames empty for ${cameraId} on ${date}`);
    }

    await this.runConcatStitch(cameraId, date, validPaths);
    const deleted = deleteRaws ? await this.deleteRaws(cameraId, date) : 0;
    logger.info(`Stitch complete: ${cameraId}/${date} (${validPaths.length} frames, deleted ${deleted} raws)`, 'TimelapseService');
    return { count: validPaths.length, path: this.getFinalPath(cameraId, date), deleted };
  }

  /** Backfill: stitch a past date's detection snapshots into MP4. */
  async generateFromDetections(
    cameraId: string,
    date: string,
    queryFn: (sql: string, params: unknown[]) => Promise<Array<{ file_path: string }>>,
  ): Promise<{ count: number; path: string; skipped: number }> {
    const rows = await queryFn(
      `SELECT file_path FROM events
       WHERE camera_id = $1
         AND timestamp >= $2::date
         AND timestamp < ($2::date + INTERVAL '1 day')
         AND file_path IS NOT NULL AND file_path != ''
       ORDER BY timestamp ASC`,
      [cameraId, date],
    );
    if (rows.length === 0) {
      throw new Error(`No detection images found for ${cameraId} on ${date}`);
    }

    const validPaths: string[] = [];
    let skipped = 0;
    for (const row of rows) {
      try {
        await fs.access(row.file_path);
        validPaths.push(row.file_path);
      } catch {
        skipped++;
      }
    }
    if (validPaths.length === 0) {
      throw new Error(`No detection image files exist on disk for ${cameraId} on ${date} (all ${rows.length} missing)`);
    }

    await this.runConcatStitch(cameraId, date, validPaths);
    logger.info(`Backfill from detections complete: ${cameraId}/${date} (${validPaths.length} frames, skipped ${skipped})`, 'TimelapseService');
    return { count: validPaths.length, path: this.getFinalPath(cameraId, date), skipped };
  }

  /**
   * Generate a past date's timelapse. Prefers raw samples (live capture);
   * falls back to detection snapshots if no raws exist.
   */
  async generateForDate(
    cameraId: string,
    date: string,
    queryFn: (sql: string, params: unknown[]) => Promise<Array<{ file_path: string }>>,
  ): Promise<{ count: number; path: string; source: 'raw' | 'detections'; skipped?: number; deleted?: number }> {
    const rawCount = await this.getRawCount(cameraId, date);
    if (rawCount > 0) {
      const r = await this.stitchFromRaw(cameraId, date);
      return { count: r.count, path: r.path, source: 'raw', deleted: r.deleted };
    }
    const r = await this.generateFromDetections(cameraId, date, queryFn);
    return { count: r.count, path: r.path, source: 'detections', skipped: r.skipped };
  }

  /** Stitch all cameras' previous-day raws. Called by the 00:01 cron. */
  async stitchYesterday(): Promise<{ cameraId: string; ok: boolean; count: number; error?: string }[]> {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return this.stitchDate(yesterday);
  }

  async stitchDate(date: string): Promise<{ cameraId: string; ok: boolean; count: number; error?: string }[]> {
    const cameraIds = this.provider.getCameraIds();
    const results: { cameraId: string; ok: boolean; count: number; error?: string }[] = [];
    for (const cameraId of cameraIds) {
      try {
        if (await this.hasTimelapse(cameraId, date)) {
          results.push({ cameraId, ok: true, count: 0 });
          continue;
        }
        const rawCount = await this.getRawCount(cameraId, date);
        if (rawCount === 0) {
          results.push({ cameraId, ok: false, count: 0, error: 'No raw frames captured' });
          continue;
        }
        const r = await this.stitchFromRaw(cameraId, date);
        results.push({ cameraId, ok: true, count: r.count });
      } catch (err) {
        results.push({ cameraId, ok: false, count: 0, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return results;
  }

  private async runConcatStitch(cameraId: string, date: string, imagePaths: string[]): Promise<void> {
    const cameraDir = path.join(this.TIMELAPSE_DIR, cameraId);
    await fs.mkdir(cameraDir, { recursive: true });
    const listPath = path.join(cameraDir, `${date}_list.txt`);
    const finalPath = this.getFinalPath(cameraId, date);

    const perImage = Math.max(1 / OUTPUT_FPS, TARGET_SECONDS / imagePaths.length);
    const escape = (p: string) => p.replace(/'/g, "'\\''");

    let listContent = '';
    for (const p of imagePaths) {
      listContent += `file '${escape(p)}'\n`;
      listContent += `duration ${perImage.toFixed(4)}\n`;
    }
    listContent += `file '${escape(imagePaths[imagePaths.length - 1])}'\n`;
    await fs.writeFile(listPath, listContent);

    const ffmpegArgs = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-vf', "scale='if(gt(iw,1280),1280,iw)':-2,fps=24,format=yuv420p",
      '-c:v', 'libx264',
      '-crf', '30',
      '-preset', 'veryfast',
      '-movflags', '+faststart',
      finalPath,
    ];

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      let stderr = '';
      ffmpeg.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      ffmpeg.on('close', (code: number) => {
        fs.unlink(listPath).catch((err: unknown) => {
          logger.warn('Failed to cleanup timelapse list file', 'TimelapseService', { error: err instanceof Error ? err.message : String(err) });
        });
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited ${code}: ${stderr.substring(0, 500)}`));
      });
      ffmpeg.on('error', (err: Error) => {
        fs.unlink(listPath).catch(() => {});
        reject(err);
      });
    });
  }

  // ── Cleanup ──

  async cleanupOldFiles(maxAgeDays = 30): Promise<number> {
    let deleted = 0;
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    try {
      const cameraDirs = await fs.readdir(this.TIMELAPSE_DIR);
      for (const cameraId of cameraDirs) {
        const cameraDir = path.join(this.TIMELAPSE_DIR, cameraId);
        const stat = await fs.stat(cameraDir).catch(() => null);
        if (!stat || !stat.isDirectory()) continue;
        await this.cleanupDir(cameraDir, cutoff, (n) => { deleted += n; });
        const rawRoot = path.join(cameraDir, RAW_SUBDIR);
        await this.cleanupRawTree(rawRoot, cutoff);
      }
    } catch (err) {
      logger.error(`Timelapse cleanup error: ${err}`, 'TimelapseService');
    }
    logger.info(`Timelapse cleanup deleted ${deleted} files older than ${maxAgeDays} days`, 'TimelapseService');
    return deleted;
  }

  private async cleanupDir(dir: string, cutoff: number, onDelete: (n: number) => void): Promise<void> {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const p = path.join(dir, entry);
      const s = await fs.stat(p).catch(() => null);
      if (!s) continue;
      if (s.isDirectory()) {
        if (entry === RAW_SUBDIR) continue;
        await this.cleanupDir(p, cutoff, onDelete);
      } else if (entry.endsWith('.mp4') && s.mtimeMs < cutoff) {
        await fs.unlink(p).catch(() => {});
        onDelete(1);
      }
    }
  }

  private async cleanupRawTree(rawRoot: string, cutoff: number): Promise<void> {
    let dateDirs: string[] = [];
    try {
      dateDirs = await fs.readdir(rawRoot);
    } catch {
      return;
    }
    for (const d of dateDirs) {
      const dirPath = path.join(rawRoot, d);
      const s = await fs.stat(dirPath).catch(() => null);
      if (!s || !s.isDirectory()) continue;
      const dateMs = new Date(`${d}T00:00:00Z`).getTime();
      if (Number.isNaN(dateMs)) continue;
      if (dateMs < cutoff) {
        await fs.rm(dirPath, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  shutdown(): void {
    this.stopSampler();
  }
}
