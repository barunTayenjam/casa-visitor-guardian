import path from 'node:path';
import { promises as fsp } from 'node:fs';
import { logger } from '../utils/logger.js';
import { serviceRegistry } from './serviceRegistry.js';

const imageCache = new Map<string, string | null>();
const imageCacheTimestamps = new Map<string, number>();
const CACHE_POSITIVE_TTL = 300_000;
const CACHE_NEGATIVE_TTL = 60_000;

async function findImagePath(filename: string, subDir: 'events/motion' | 'snapshots'): Promise<string | null> {
  const now = Date.now();
  const cached = imageCache.get(filename);
  const cacheTime = imageCacheTimestamps.get(filename);

  if (cached !== undefined && cacheTime !== undefined) {
    const ttl = cached !== null ? CACHE_POSITIVE_TTL : CACHE_NEGATIVE_TTL;
    if (now - cacheTime < ttl) {
      return cached;
    }
    imageCache.delete(filename);
    imageCacheTimestamps.delete(filename);
  }

  const nowDate = new Date();
  const currentYM = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`;
  const likelyPath = path.join(process.cwd(), 'data', 'detections', currentYM, subDir, filename);

  try {
    await fsp.access(likelyPath);
    imageCache.set(filename, likelyPath);
    imageCacheTimestamps.set(filename, now);
    return likelyPath;
  } catch { /* not in current month, scan further */ }

  for (let y = nowDate.getFullYear(); y >= nowDate.getFullYear() - 4; y--) {
    const startMonth = y === nowDate.getFullYear() ? nowDate.getMonth() : 11;
    for (let m = startMonth; m >= 1; m--) {
      if (y === nowDate.getFullYear() && m === nowDate.getMonth() + 1) continue;
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      const candidate = path.join(process.cwd(), 'data', 'detections', ym, subDir, filename);
      try {
        await fsp.access(candidate);
        imageCache.set(filename, candidate);
        imageCacheTimestamps.set(filename, now);
        return candidate;
      } catch { continue; }
    }
  }

  imageCache.set(filename, null);
  imageCacheTimestamps.set(filename, now);
  return null;
}

async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

interface ResolveImageOptions {
  fileTypes: string[];
  fallbackSubDir: 'events/motion' | 'snapshots';
}

async function resolveImage(filename: string, options: ResolveImageOptions): Promise<string | null> {
  const { fileTypes, fallbackSubDir } = options;

  try {
    const dataSource = serviceRegistry.getAppDataSource();
    const placeholders = fileTypes.map((_, i) => `$${i + 2}`).join(', ');
    const query = `
      SELECT storage_path
      FROM detection_files
      WHERE original_filename = $1
        AND file_type IN (${placeholders})
        AND is_deleted = FALSE
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const results: { storage_path: string }[] = await dataSource.query(query, [filename, ...fileTypes]);

    if (results.length > 0) {
      let imagePath = results[0].storage_path;
      if (!path.isAbsolute(imagePath)) {
        imagePath = path.join(process.cwd(), 'data', 'detections', imagePath);
      }
      if (await checkFileExists(imagePath)) {
        return imagePath;
      }
    }
  } catch (dbError: unknown) {
    const msg = dbError instanceof Error ? dbError.message : String(dbError);
    logger.warn(`Database query failed, falling back to file system scan: ${msg}`, 'ImageFileService');
  }

  return findImagePath(filename, fallbackSubDir);
}

export const imageFileService = { resolveImage };
