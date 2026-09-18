import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../utils/logger.js';

export interface ImageResolutionResult {
  imagePath: string;
  filename: string;
}

export class ImageResolver {
  resolveFromEvent(event: { file_path: string | null }): ImageResolutionResult | null {
    if (!event.file_path) return null;

    const storedPath = event.file_path;
    const filename = path.basename(storedPath);
    const possiblePaths = this.buildPossiblePaths(storedPath, filename);

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return { imagePath: p, filename };
      }
    }

    return null;
  }

  resolveFromPath(filePath: string): ImageResolutionResult | null {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    // Sandbox: ensure resolved path is within allowed directories
    const resolved = path.resolve(absolutePath);
    const allowedDirs = [
      path.resolve(process.cwd()),
      path.resolve(process.cwd(), 'data'),
      '/app/data',
    ].filter(Boolean);
    
    if (!allowedDirs.some(dir => resolved.startsWith(dir))) {
      logger.warn(`Path traversal attempt blocked: ${filePath}`, 'ImageResolver');
      return null;
    }

    if (!fs.existsSync(resolved)) {
      return null;
    }

    return {
      imagePath: resolved,
      filename: path.basename(resolved),
    };
  }

  private buildPossiblePaths(storedPath: string, filename: string): string[] {
    const possiblePaths: string[] = [];

    if (path.isAbsolute(storedPath)) {
      if (storedPath.startsWith('/app/data/')) {
        possiblePaths.push(storedPath.replace('/app/', path.join(process.cwd(), '..') + '/'));
        possiblePaths.push(storedPath.replace('/app/', process.cwd() + '/'));
      }
      possiblePaths.push(storedPath);
    }

    possiblePaths.push(
      path.join(process.cwd(), storedPath),
      path.join(process.cwd(), '..', storedPath),
    );

    possiblePaths.push(
      path.join(process.cwd(), 'public', 'events', filename),
      path.join(process.cwd(), 'public', filename),
    );

    const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const yearMonth = `${dateMatch[1]}-${dateMatch[2]}`;
      const eventTypeDir = storedPath.includes('/faces/') ? 'faces' : 'motion';

      possiblePaths.push(
        path.join(
          process.cwd(),
          'data',
          'detections',
          yearMonth,
          'events',
          eventTypeDir,
          filename,
        ),
        path.join(
          process.cwd(),
          '..',
          'data',
          'detections',
          yearMonth,
          'events',
          eventTypeDir,
          filename,
        ),
        `/app/data/detections/${yearMonth}/events/${eventTypeDir}/${filename}`,
      );
    }

    return possiblePaths;
  }
}

export const imageResolver = new ImageResolver();
