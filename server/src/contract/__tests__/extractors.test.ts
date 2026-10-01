import { describe, it, expect } from '@jest/globals';
import {
  normalizePath,
  matchPath,
  parseMounts,
  parseRouteSource,
  parseConfigureSource,
  parseFrontendSource,
} from '../extractors.js';

describe('normalizePath', () => {
  it('replaces the ${API_URL} template form with /api', () => {
    expect(normalizePath('${API_URL}/cameras')).toBe('/api/cameras');
  });

  it('replaces the bare API_URL form with /api', () => {
    expect(normalizePath('API_URL/cameras')).toBe('/api/cameras');
  });

  it('strips query strings', () => {
    expect(normalizePath('/api/motion/events?limit=${limit}')).toBe('/api/motion/events');
  });

  it('strips hash fragments', () => {
    expect(normalizePath('/api/cameras#section')).toBe('/api/cameras');
  });

  it('replaces :param segments with *', () => {
    expect(normalizePath('/api/cameras/:cameraId')).toBe('/api/cameras/*');
  });

  it('replaces ${...} interpolations with *', () => {
    expect(normalizePath('/api/analytics/daily/${date}')).toBe('/api/analytics/daily/*');
  });

  it('collapses duplicate slashes', () => {
    expect(normalizePath('/api//cameras///list')).toBe('/api/cameras/list');
  });

  it('ensures a leading slash', () => {
    expect(normalizePath('api/cameras')).toBe('/api/cameras');
  });
});

describe('matchPath', () => {
  it('matches identical paths', () => {
    expect(matchPath('/api/cameras', '/api/cameras')).toBe(true);
  });

  it('matches a * wildcard against exactly one non-empty segment', () => {
    expect(matchPath('/api/cameras/*', '/api/cameras/abc')).toBe(true);
  });

  it('rejects length mismatches', () => {
    expect(matchPath('/api/cameras/*', '/api/cameras/abc/def')).toBe(false);
    expect(matchPath('/api/cameras/*', '/api/cameras')).toBe(false);
  });

  it('does not let * match an empty segment', () => {
    expect(matchPath('/api/cameras/*', '/api/cameras/')).toBe(false);
  });

  it('normalizes :params on both sides', () => {
    expect(matchPath('/api/cameras/:id', '/api/cameras/5')).toBe(true);
  });

  it('normalizes ${...} interpolations on both sides', () => {
    expect(matchPath('/api/cameras/${id}', '/api/cameras/5')).toBe(true);
    expect(matchPath('/api/cameras/:id', '/api/cameras/${other}')).toBe(true);
  });
});

describe('parseMounts', () => {
  it('maps mounted prefixes to their imported route files', () => {
    const source = `
import authRoutes from './auth.js';
app.use('/api/auth', authRoutes);
app.use('/api', somethingElse);
import healthRoutes from './health.js';
app.use('/health', healthRoutes);
`;
    expect(parseMounts(source)).toEqual([
      { prefix: '/api/auth', routerVariable: 'authRoutes', routeFile: 'auth' },
    ]);
  });

  it('handles mixed default and named imports', () => {
    const source = `
import timelapseRoutes, { setTimelapseService } from './timelapse.js';
app.use('/api/timelapse', timelapseRoutes);
`;
    expect(parseMounts(source)).toEqual([
      { prefix: '/api/timelapse', routerVariable: 'timelapseRoutes', routeFile: 'timelapse' },
    ]);
  });
});

describe('parseRouteSource', () => {
  it('extracts multiline route definitions', () => {
    const source = `
router.get(
  '/search',
  optionalAuth,
  (req, res) => eventController.search(req, res),
);
`;
    expect(parseRouteSource(source, 'events.ts')).toEqual([
      { method: 'get', path: '/search', file: 'events.ts' },
    ]);
  });

  it('extracts parameterized paths verbatim', () => {
    const source = `router.post('/:cameraId/simulate', handler);`;
    expect(parseRouteSource(source, 'motion.ts')).toEqual([
      { method: 'post', path: '/:cameraId/simulate', file: 'motion.ts' },
    ]);
  });

  it('extracts all supported verbs', () => {
    const source = `
router.get('/a', h);
router.post('/b', h);
router.put('/c', h);
router.delete('/d', h);
router.patch('/e', h);
router.use('/f', h);
`;
    expect(parseRouteSource(source, 'x.ts')).toEqual([
      { method: 'get', path: '/a', file: 'x.ts' },
      { method: 'post', path: '/b', file: 'x.ts' },
      { method: 'put', path: '/c', file: 'x.ts' },
      { method: 'delete', path: '/d', file: 'x.ts' },
      { method: 'patch', path: '/e', file: 'x.ts' },
    ]);
  });
});

describe('parseConfigureSource', () => {
  it('includes direct /api app routes and skips non-api and app.use mounts', () => {
    const source = `
app.get('/api/health', h);
app.get('/stream/:cameraId', h);
app.use('/api/auth', authRoutes);
app.post('/api/analyze', h);
`;
    expect(parseConfigureSource(source, 'index.ts')).toEqual([
      { method: 'get', path: '/api/health', file: 'index.ts' },
      { method: 'post', path: '/api/analyze', file: 'index.ts' },
    ]);
  });
});

describe('parseFrontendSource', () => {
  it('DEFAULT_GET: fetchWithRetry with no method option defaults to get', () => {
    const source = 'const r = fetchWithRetry(`${API_URL}/cameras`);';
    expect(parseFrontendSource(source, 'cameraService.ts')).toEqual([
      { method: 'get', path: '/api/cameras', file: 'cameraService.ts' },
    ]);
  });

  it('METHOD_OPTION: captures method from the option and keeps ${...} intact', () => {
    const source =
      "const r = fetchWithRetry(`${API_URL}/cameras/${id}`, { method: 'DELETE' });";
    expect(parseFrontendSource(source, 'cameraService.ts')).toEqual([
      { method: 'delete', path: '/api/cameras/${id}', file: 'cameraService.ts' },
    ]);
  });

  it('strips query strings before wildcarding', () => {
    const source = 'const r = fetchWithRetry(`${API_URL}/motion/events?limit=${limit}`);';
    expect(parseFrontendSource(source, 'motionService.ts')).toEqual([
      { method: 'get', path: '/api/motion/events', file: 'motionService.ts' },
    ]);
  });

  it('apiGet endpoints are /api-rooted', () => {
    const source = 'const d = await apiGet<InsightsEnvelope>(`/analytics/daily/${date}`);';
    expect(parseFrontendSource(source, 'insightsService.ts')).toEqual([
      { method: 'get', path: '/api/analytics/daily/${date}', file: 'insightsService.ts' },
    ]);
  });

  it('derives the method from verb-bearing call names (apiPost, apiClient.post)', () => {
    const source = `
await apiPost('/settings/mfa/enable', body);
await apiClient.post(\`/detection/person/\${id}/trigger\`, { body });
await apiClient.delete(\`/face-clusters/\${id}\`);
`;
    expect(parseFrontendSource(source, 'service.ts')).toEqual([
      { method: 'post', path: '/api/settings/mfa/enable', file: 'service.ts' },
      { method: 'post', path: '/api/detection/person/${id}/trigger', file: 'service.ts' },
      { method: 'delete', path: '/api/face-clusters/${id}', file: 'service.ts' },
    ]);
  });

  it('captures return `/api/...` builders', () => {
    const source = 'function u(id: string) { return `/api/cameras/${id}/snapshot`; }';
    expect(parseFrontendSource(source, 'snapshot.ts')).toEqual([
      { method: 'get', path: '/api/cameras/${id}/snapshot', file: 'snapshot.ts' },
    ]);
  });

  it('skips non-api paths such as the snapshot image builder', () => {
    const source = `
function getSnapshotImageUrl(filename: string) { return \`/snapshots/\${filename}\`; }
const r = fetchWithRetry('https://example.com/hook');
`;
    expect(parseFrontendSource(source, 'cameraService.ts')).toEqual([]);
  });

  it('spans newlines between the call and its arguments', () => {
    const source = `
const response = await fetchWithRetry(
  \`\${API_URL}/events\`,
  { method: 'POST' },
);
`;
    expect(parseFrontendSource(source, 'eventService.ts')).toEqual([
      { method: 'post', path: '/api/events', file: 'eventService.ts' },
    ]);
  });

  it('captures variable-assigned ${API_URL} templates as get', () => {
    const source =
      'const url = `${API_URL}/analytics/hourly${qs ? `?${qs}` : ""}`;\nawait fetchWithRetry(url);';
    expect(parseFrontendSource(source, 'systemService.ts')).toEqual([
      { method: 'get', path: '/api/analytics/hourly', file: 'systemService.ts' },
    ]);
  });

  it('ignores calls whose first argument is not a literal', () => {
    const source = 'const r = fetchWithRetry(someVariable, { method: "POST" });';
    expect(parseFrontendSource(source, 'x.ts')).toEqual([]);
  });

  it('resolves variable endpoints consumed by api-rooted calls', () => {
    const source = [
      'const endpoint = camera ? `/detection?camera=${camera}` : "/detection";',
      'await apiClient.get(endpoint);',
      'await apiClient.put(endpoint, body);',
    ].join('\n');
    expect(parseFrontendSource(source, 'settingsService.ts')).toEqual([
      { method: 'get', path: '/api/detection', file: 'settingsService.ts' },
      { method: 'put', path: '/api/detection', file: 'settingsService.ts' },
    ]);
  });
});
