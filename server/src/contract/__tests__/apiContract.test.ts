import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseMounts,
  parseRouteSource,
  parseConfigureSource,
  parseFrontendSource,
  matchPath,
  normalizePath,
  type RouteEntry,
  type CallEntry,
} from '../extractors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SERVER_SRC = path.join(REPO_ROOT, 'server', 'src');
const FRONTEND_API_DIR = path.join(REPO_ROOT, 'frontend-next', 'src', 'services', 'api');
const ALLOWLIST_PATH = path.join(__dirname, '..', 'internalEndpoints.json');

interface AllowlistEntry {
  method: string;
  path: string;
  reason: string;
}

function joinPath(prefix: string, routePath: string): string {
  const base = prefix.replace(/\/+$/, '');
  const suffix = routePath.startsWith('/') ? routePath : '/' + routePath;
  const joined = base + (suffix === '/' ? '' : suffix);
  return normalizePath(joined);
}

function loadRoutes(): RouteEntry[] {
  const indexSrc = fs.readFileSync(path.join(SERVER_SRC, 'routes', 'index.ts'), 'utf8');
  const routes: RouteEntry[] = parseConfigureSource(indexSrc, 'routes/index.ts');
  for (const mount of parseMounts(indexSrc)) {
    const file = path.join(SERVER_SRC, 'routes', `${mount.routeFile}.ts`);
    const src = fs.readFileSync(file, 'utf8');
    for (const entry of parseRouteSource(src, `routes/${mount.routeFile}.ts`)) {
      routes.push({
        method: entry.method,
        path: joinPath(mount.prefix, entry.path),
        file: entry.file,
      });
    }
  }
  return routes;
}

function loadCalls(): CallEntry[] {
  const files = fs.readdirSync(FRONTEND_API_DIR).filter((f) => f.endsWith('.ts'));
  const calls: CallEntry[] = [];
  for (const file of files) {
    const src = fs.readFileSync(path.join(FRONTEND_API_DIR, file), 'utf8');
    calls.push(...parseFrontendSource(src, file));
  }
  return calls;
}

function loadAllowlist(): { entries: AllowlistEntry[]; shapeErrors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  } catch (err) {
    return {
      entries: [],
      shapeErrors: [`allowlist is not valid JSON: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
  if (!Array.isArray(raw)) {
    return { entries: [], shapeErrors: ['allowlist must be a JSON array'] };
  }
  const shapeErrors: string[] = [];
  const entries: AllowlistEntry[] = [];
  raw.forEach((item: unknown, i: number) => {
    const e = item as Partial<AllowlistEntry>;
    if (
      !e ||
      typeof e.method !== 'string' ||
      !e.method ||
      typeof e.path !== 'string' ||
      !e.path ||
      typeof e.reason !== 'string' ||
      !e.reason.trim()
    ) {
      shapeErrors.push(
        `entry ${i} invalid: needs non-empty string method, path, and reason — got ${JSON.stringify(item)}`,
      );
      return;
    }
    entries.push({ method: e.method, path: e.path, reason: e.reason });
  });
  return { entries, shapeErrors };
}

const routes = loadRoutes();
const calls = loadCalls();
const allowlist = loadAllowlist();

function allowlistCoversRoute(entry: AllowlistEntry, route: RouteEntry): boolean {
  if (entry.method.toLowerCase() !== route.method.toLowerCase()) return false;
  const a = normalizePath(entry.path);
  const b = normalizePath(route.path);
  return matchPath(a, b) || matchPath(b, a);
}

describe('API contract', () => {
  it('sanity: extraction finds routes and frontend calls', () => {
    expect(routes.length).toBeGreaterThan(100);
    expect(calls.length).toBeGreaterThan(50);
  });

  it('every frontend /api call resolves to a registered route', () => {
    const unmatched = calls.filter(
      (call) =>
        !routes.some(
          (route) =>
            route.method.toLowerCase() === call.method.toLowerCase() &&
            matchPath(route.path, call.path),
        ),
    );
    const detail = unmatched
      .map((c) => `  \`${c.method.toUpperCase()} ${c.path}\` from ${c.file}`)
      .join('\n');
    expect(
      unmatched.length === 0
        ? null
        : `Unmatched frontend calls:\n${detail}\nhint: route missing → add route or fix frontend URL`,
    ).toBeNull();
  });

  it('every route is frontend-called or allowlisted', () => {
    const uncalled = routes.filter(
      (route) =>
        !calls.some(
          (call) =>
            call.method.toLowerCase() === route.method.toLowerCase() &&
            matchPath(route.path, call.path),
        ) &&
        !allowlist.entries.some((entry) => allowlistCoversRoute(entry, route)),
    );
    const detail = uncalled
      .map((r) => `  \`${r.method.toUpperCase()} ${r.path}\` from ${r.file}`)
      .join('\n');
    expect(
      uncalled.length === 0
        ? null
        : `Unclassified routes:\n${detail}\nhint: wire it, allowlist it in internalEndpoints.json with a reason, or delete it\nbefore allowlisting, rg the repo for this path to find non-frontend consumers`,
    ).toBeNull();
  });

  it('allowlist entries are non-stale and reasoned', () => {
    const problems = [...allowlist.shapeErrors];
    for (const entry of allowlist.entries) {
      if (!routes.some((route) => allowlistCoversRoute(entry, route))) {
        problems.push(
          `stale: \`${entry.method.toUpperCase()} ${entry.path}\` matches no registered route — remove it or fix the path`,
        );
      }
    }
    expect(problems.join('\n') || null).toBeNull();
  });
});
