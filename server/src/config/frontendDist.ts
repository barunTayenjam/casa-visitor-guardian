import fs from 'node:fs';
import path from 'node:path';

export function getFrontendDistPath() {
  const configuredPath = process.env.FRONTEND_DIST_PATH;
  if (configuredPath) return path.resolve(process.cwd(), configuredPath);

  const candidates = [
    path.resolve(process.cwd(), '..', 'frontend-next', 'out'),
    path.resolve(process.cwd(), 'frontend-next', 'out'),
    path.resolve(process.cwd(), 'public'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[candidates.length - 1];
}
