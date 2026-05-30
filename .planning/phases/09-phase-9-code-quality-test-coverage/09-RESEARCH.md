# Phase 9: Code Quality & Test Coverage - Research

**Researched:** 2026-05-30
**Domain:** TypeScript/Node.js backend decomposition, Python Flask decomposition, Jest testing, logging standardization
**Confidence:** HIGH

## Summary

This phase decomposes 4 monolithic backend files (totaling ~4,500 lines), replaces 289 `console.*` calls across 42 files with the structured logger, adds critical-path frontend tests (zero exist today), and adds controller tests for AuthController and CameraController. The server already has 21 test files and a working jest config; the frontend has jest+ts-jest in devDependencies but NO jest config file and NO test files.

**Primary recommendation:** Decompose backend files first (highest risk, most mechanical), then logging standardization (grep-and-replace with semantic review), then tests (new infrastructure needed for frontend, extend existing for backend).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full decomposition of 4 monolithic backend files: index.ts (623L), nvidiaAnalysisService.ts (1063L), opencv-service/app.py (1693L), eventSearchService.ts (673L). Frontend files deferred.
- **D-02:** Test scope = critical path only: AuthController, CameraController, baseClient.ts, AuthContext.tsx, cacheService
- **D-03:** CI pipeline deferred to backlog
- **D-04:** CQ-06 (duplicate .env) ALREADY DONE in Phase 7 — skip
- **D-05:** CQ-08 (hardcoded timezone) ALREADY DONE in Phase 7 — skip
- **D-06:** index.ts → extract static routes to routes/staticRoutes.ts, Socket.io bootstrap stays minimal, target < 100 lines
- **D-07:** nvidiaAnalysisService → split into nvidiaClient.ts, nvidiaProcessor.ts, nvidiaCache.ts
- **D-08:** Python app.py → blueprints: routes_detection.py, routes_streaming.py, routes_system.py, pipeline.py; app.py as factory < 100 lines
- **D-09:** Replace console.* with logger.* in production code, exclude startup/bootstrap and test files
- **D-10:** Replace hardcoded Docker path in rtspManager.ts with SIMULATION_SNAPSHOT_DIR config
- **D-11:** All decompositions preserve existing public API surface — no breaking changes
- **D-12:** Frontend tests use Jest + React Testing Library

### Agent's Discretion
- Exact module boundaries within each decomposition
- Test file organization and helper structure
- Order of console.* → logger.* replacement per file

### Deferred Ideas (OUT OF SCOPE)
- CI-01 — GitHub Actions CI pipeline
- Frontend file decomposition — Settings.tsx (793L), EventsPage.tsx (747L), CameraStream.tsx (668L)
- Comprehensive test coverage — full controller + service test suite
- TEST-03 service tests — Reduced to cacheService only
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CQ-01 | index.ts is 606 lines — bootstrap, static routes, Socket.io handlers, image caching | Sections: index.ts Decomposition, Architecture Patterns |
| CQ-02 | Duplicated event/snapshot serving logic in index.ts (lines 114-219) | Sections: index.ts Decomposition, Don't Hand-Roll |
| CQ-03 | nvidiaAnalysisService.ts is 1063 lines monolith with 3 analysis modes + API client + parsing | Sections: nvidiaAnalysisService Decomposition |
| CQ-04 | opencv-service/app.py is 1693 lines with 13 Flask routes, 4 classes, pipeline wiring | Sections: Python app.py Decomposition |
| CQ-05 | 289 console.* calls across 42 files in server/src/ | Sections: Logging Standardization |
| CQ-07 | Hardcoded `/app/data/detections/` Docker path in rtspManager.ts:394 | Sections: Hardcoded Docker Path |
| TEST-01 | Zero frontend tests — no jest.config, no test files, no @testing-library deps | Sections: Frontend Tests |
| TEST-02 | No controller tests (AuthController 272L, CameraController 412L) | Sections: Backend Controller Tests |
| TEST-03 | cacheService.ts (297L) — Redis with in-memory fallback | Sections: cacheService Tests |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Static file serving (events/snapshots) | Backend (Express routes) | — | File resolution + DB lookup belongs in route handlers |
| Socket.io event relay | Backend (index.ts bootstrap) | — | Server-side socket wiring for Python→Client pipeline |
| NVIDIA API integration | Backend (services) | — | External API calls, image processing, response parsing |
| Python detection pipeline | OpenCV Service | — | Flask routes + pipeline orchestration |
| Logging | Backend (utils) | — | Structured logger used across all tiers |
| Frontend tests | Test infrastructure (Jest) | — | jsdom environment for React component + utility testing |
| Backend controller tests | Test infrastructure (Jest + supertest) | — | Node environment with mocked dependencies |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jest | ^30.2.0 (installed both frontend+server) | Test framework | Already installed, server tests use it [VERIFIED: npm registry] |
| ts-jest | ^29.4.5 (installed both frontend+server) | TypeScript Jest transform | Already installed, server jest.config uses it [VERIFIED: npm registry] |
| supertest | ^7.1.4 (installed server) | HTTP assertion for controller tests | Already installed [VERIFIED: npm registry] |
| @types/jest | ^30.0.0 (installed server) | Jest type definitions | Already installed [VERIFIED: npm registry] |
| @types/supertest | ^6.0.3 (installed server) | Supertest type definitions | Already installed [VERIFIED: npm registry] |

### New Dependencies (frontend only)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | 16.3.2 | React component testing | AuthContext, React hook tests [VERIFIED: npm registry] |
| @testing-library/jest-dom | 6.9.1 | DOM assertion matchers | All frontend tests [VERIFIED: npm registry] |
| @testing-library/user-event | 14.6.1 | User interaction simulation | Form/input tests [VERIFIED: npm registry] |
| jest-environment-jsdom | 30.4.1 | jsdom test environment | Frontend jest config [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Jest + ts-jest | Vitest | Vitest is faster but project already invested in Jest + ts-jest across server tests. Not worth migration. |
| React Testing Library | Enzyme | RTL is the React-standard testing approach. Enzyme is deprecated for React 18. |

**Installation:**
```bash
cd frontend && npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| jest | npm | 10+ yrs | 30M+/wk | github.com/jestjs/jest | [SUS] (false positive) | Approved — well-known framework, slopcheck flags typosquat proximity to "next" |
| ts-jest | npm | 8+ yrs | 10M+/wk | github.com/kulshekhar/ts-jest | [OK] | Approved |
| supertest | npm | 10+ yrs | 5M+/wk | github.com/visionmedia/supertest | [OK] | Approved |
| @testing-library/react | npm | 6+ yrs | 15M+/wk | github.com/testing-library/react-testing-library | [OK] | Approved |
| @testing-library/jest-dom | npm | 6+ yrs | 12M+/wk | github.com/testing-library/jest-dom | [OK] | Approved |
| @testing-library/user-event | npm | 5+ yrs | 6M+/wk | github.com/testing-library/user-event | [OK] | Approved |
| jest-environment-jsdom | npm | 4+ yrs | 10M+/wk | github.com/jestjs/jest (monorepo) | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** jest — false positive (slopcheck flags typosquat proximity to "next" package). Jest is a top-10 npm package, safe to use.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (React)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ baseClient.ts│  │AuthContext.tsx│  │ (no tests yet)        │  │
│  │ [TO TEST]    │  │ [TO TEST]    │  │                       │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────────────┘  │
│         │ fetch          │ authService                          │
└─────────┼────────────────┼──────────────────────────────────────┘
          │                │
┌─────────┼────────────────┼──────────────────────────────────────┐
│         ▼                ▼         Backend (Express 5)           │
│  ┌──────────────┐  ┌──────────────┐                              │
│  │  Routes /     │  │AuthController│  [TO TEST]                  │
│  │  index.ts     │  │CameraControl.│  [TO TEST]                  │
│  │  [DECOMPOSE]  │  └──────┬───────┘                              │
│  └──────┬───────┘         │                                       │
│         │                 │                                       │
│  ┌──────┴─────────────────┴──────────────────┐                   │
│  │            Services Layer                   │                   │
│  │  ┌─────────────────┐  ┌────────────────┐  │                   │
│  │  │nvidiaAnalysis   │  │cacheService    │  │                   │
│  │  │[DECOMPOSE]      │  │[TO TEST]       │  │                   │
│  │  └─────────────────┘  └────────────────┘  │                   │
│  │  ┌─────────────────┐  ┌────────────────┐  │                   │
│  │  │eventSearchServ. │  │rtspManager     │  │                   │
│  │  │[DECOMPOSE]      │  │[FIX PATH]      │  │                   │
│  │  └─────────────────┘  └────────────────┘  │                   │
│  └────────────────────────────────────────────┘                   │
│         │ logger.* (replace console.*)                             │
└─────────┼─────────────────────────────────────────────────────────┘
          │ WebSocket
┌─────────┼─────────────────────────────────────────────────────────┐
│         ▼         OpenCV Service (Python Flask)                    │
│  ┌──────────────┐                                                  │
│  │   app.py     │  [DECOMPOSE into blueprints]                     │
│  │   13 routes  │──────────▶ routes_detection.py                   │
│  │   4 classes  │──────────▶ routes_streaming.py                   │
│  │   pipeline   │──────────▶ routes_system.py                      │
│  │              │──────────▶ pipeline.py                            │
│  └──────────────┘                                                  │
└────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

#### Backend Decomposition — index.ts (606L → < 100L)

```typescript
// BEFORE: server/src/index.ts (606 lines)
// Contains: image cache, static routes, Socket.io, service init, shutdown, server start

// AFTER:
server/src/
├── index.ts                    # < 100L: imports, app config, middleware, route mounting, server start
├── routes/
│   └── staticRoutes.ts         # Image serving: /events/:filename, /snapshots/:filename, static dirs
├── services/
│   └── imageFileService.ts     # Image cache + findImagePath + checkFileExists
├── bootstrap/
│   └── serviceInitializer.ts   # initializeServices() function
│   └── socketSetup.ts          # Socket.io connection + tracking event relay
│   └── shutdown.ts             # gracefulShutdown() function
```

#### Backend Decomposition — nvidiaAnalysisService.ts (1063L → 4 modules)

```typescript
// BEFORE: server/src/services/nvidiaAnalysisService.ts (1063 lines)
// Contains: types, prompts, API client, response parsing, 3 analysis functions, drawing

// AFTER:
server/src/services/nvidia/
├── types.ts                # All interfaces (AnalysisContext, BoundingBox, NvidianalysisResult, etc.)
├── prompts.ts              # SYSTEM_PROMPT, BBOX_SYSTEM_PROMPT, PERSON_SYSTEM_PROMPT
├── nvidiaClient.ts         # callNvidiaApi(), imageToBase64(), normalizeEntityArray()
├── nvidiaProcessor.ts      # parseAIResponse(), buildResult(), drawBoundingBoxes()
├── nvidiaAnalysisService.ts # Public API: analyzeImage(), checkApiHealth(), analyzeWithBoundingBoxes(), analyzePersons()
```

#### Backend Decomposition — eventSearchService.ts (673L)

```typescript
// BEFORE: server/src/services/eventSearchService.ts (673 lines)
// Contains: 5 filter interfaces, 1 class with 13 methods

// AFTER:
server/src/services/eventSearch/
├── types.ts                # All filter/response interfaces
├── queryBuilders.ts        # SQL query construction helpers (extracted from listEnhanced, getHistory, etc.)
├── eventSearchService.ts   # Main class with methods, using queryBuilders
```

#### Python Decomposition — app.py (1693L → 5 files)

```python
# BEFORE: opencv-service/app.py (1693 lines)
# Contains: 13 routes, 4 classes, RTSP startup, global state, pipeline wiring

# AFTER:
opencv-service/
├── app.py                  # < 100L: Flask app factory, blueprint registration, start_rtsp_service()
├── routes/
│   ├── detection.py        # /detect-motion, /detect-objects, /detect-and-draw, /annotate-by-path, /recognize-faces
│   ├── batch.py            # /detect-batch, /detect-batch-paths
│   ├── face.py             # /train-face, /retrain-model, /known-faces
│   └── system.py           # /health, /status, /api/rtsp/metrics
├── services/
│   ├── detection_cache.py  # DetectionCache class (PostgreSQL-backed)
│   ├── redis_cache.py      # RedisDetectionCache class
│   ├── yolo_detector.py    # YOLOObjectDetector class
│   └── motion_detector.py  # MotionDetector class
├── pipeline.py             # Pipeline wiring: RTSPService init, face recognition init, detector init
└── utils.py                # draw_detections(), load_class_names(), shared helpers
```

### Pattern 1: Express Route Extraction (CQ-01/CQ-02)

**What:** Extract inline route handlers from index.ts into dedicated route modules.
**When to use:** When index.ts has more than just app setup.

```typescript
// Source: Project convention — routes/*.ts pattern already used
// routes/staticRoutes.ts
import { Router, Request, Response } from 'express';
import { imageFileService } from '../services/imageFileService.js';

export const staticRoutes = Router();

staticRoutes.get('/events/:filename', async (req: Request, res: Response) => {
  // Moved from index.ts:114-165
  const filename = req.params.filename;
  // ... validation + DB lookup + fallback
});

staticRoutes.get('/snapshots/:filename', async (req: Request, res: Response) => {
  // DEDUPLICATED from events handler — shared DB lookup + fallback logic
});
```

### Pattern 2: Flask Blueprint Decomposition (CQ-04)

**What:** Split Flask monolith into blueprint modules following Flask best practices.
**When to use:** Single file with > 10 routes.

```python
# Source: Flask 3.0 Blueprint pattern [CITED: flask.palletsprojects.com/en/3.0.x/blueprints/]
# routes/detection.py
from flask import Blueprint, request, jsonify

detection_bp = Blueprint('detection', __name__)

@detection_bp.route('/detect-motion', methods=['POST'])
def detect_motion():
    # Moved from app.py
    pass

# app.py (factory)
from routes.detection import detection_bp
app.register_blueprint(detection_bp)
```

### Pattern 3: Controller Testing with Dependency Injection (TEST-02)

**What:** Test controllers by mocking the service layer via constructor injection.
**When to use:** Controllers that depend on services.

```typescript
// Source: Existing pattern in AuthController.ts — constructor accepts AuthService
// AuthController already uses DI: constructor(authServiceInstance: AuthService)
const mockAuthService = {
  login: jest.fn().mockResolvedValue({ success: true, user: {}, token: 'test' }),
  register: jest.fn().mockResolvedValue({ success: true, user: {}, token: 'test' }),
  // ... other methods
};
const controller = new AuthController(mockAuthService as any);
```

### Anti-Patterns to Avoid
- **Decomposition without preserving imports:** Consumers import from `nvidiaAnalysisService.ts` — the default export must continue working. Use re-exports.
- **Moving global state in Python:** app.py uses module-level globals (`_rtsp_service`, `face_recognition`, `detector`, `redis_client`). These must be carefully managed during blueprint extraction.
- **Testing with real database:** Controller tests must mock TypeORM. Use `jest.mock()` or inject mock repositories.
- **Breaking Socket.io event names:** The trackingEvent handler in index.ts emits `personDetected`, `faceDetected`, `motionDetected`, `detection` events. These event names are the frontend contract.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image file serving with cache | Custom cache per file | Extract to imageFileService.ts with shared logic | Both /events and /snapshots routes have identical DB-lookup + fallback logic |
| Test doubles for fetch | Manual fetch mocking | jest.fn() + jest.mock() for service layer | Consistent, type-safe mocking |
| Frontend DOM testing | Direct DOM assertion | @testing-library/react render() + screen | Standard React testing approach |
| Python route grouping | Manual function registration | Flask Blueprint API | Industry standard, supported by Flask 3.0 |

**Key insight:** The events/snapshot serving handlers in index.ts (lines 114-165 and 168-219) are nearly identical — they differ only in the DB query (`file_type = 'event_face'/'event_motion'` vs `file_type = 'snapshot'`) and the fallback subdirectory. This should be a single utility function parameterized by file type.

## Common Pitfalls

### Pitfall 1: Python Global State Migration
**What goes wrong:** app.py has 6+ module-level globals (`_rtsp_service`, `face_recognition`, `detector`, `motion_detector`, `redis_client`, `redis_cache`, `class_names`) that are used across routes. Naively moving routes to blueprints breaks references.
**Why it happens:** Flask blueprints can't access module globals from the parent without explicit passing.
**How to avoid:** Use Flask's `app.config` or `app.extensions` for shared state, or pass instances explicitly via blueprint factory functions. Alternatively, use a `state.py` module that holds initialized instances.
**Warning signs:** `NameError: name 'detector' is not defined` after moving route to blueprint.

### Pitfall 2: ESM Module Resolution in Jest
**What goes wrong:** The project uses `"type": "module"` with `.js` extension imports (`import { X } from './module.js'`). Jest with ts-jest needs `moduleNameMapper` to strip `.js` extensions.
**Why it happens:** TypeScript ESM conventions differ from Node.js resolution.
**How to avoid:** The server jest.config already has `moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' }`. The frontend jest config must replicate this.
**Warning signs:** `Cannot find module './baseClient.js'` in tests.

### Pitfall 3: index.ts import.meta.url
**What goes wrong:** index.ts uses `import.meta.url` for `__dirname` (line 15). After decomposition, the extracted modules may need their own path resolution. Previous phases hit this with jest (ts-jest ESM wrapper incompatibility).
**Why it happens:** `import.meta.url` is module-scoped — it resolves to the file's own location.
**How to avoid:** Use `process.cwd()` for project-relative paths, or pass paths from the entry point. The existing `findImagePath` already uses `process.cwd()`.
**Warning signs:** `path.resolve` returning wrong directory after file move.

### Pitfall 4: Frontend jest.config Missing
**What goes wrong:** Frontend has jest + ts-jest in devDependencies but no jest.config.js. Running `npm test` will fail because Vite's `import.meta.env` and path aliases (`@/`) won't resolve.
**Why it happens:** Vite handles module resolution at build time; Jest needs explicit config.
**How to avoid:** Create `frontend/jest.config.js` with moduleNameMapper for `@/` alias and `import.meta.env` mock. Add `jest-environment-jsdom` for DOM APIs.
**Warning signs:** `Cannot find module '@/services/api/baseClient'` in tests.

### Pitfall 5: Logger Circular Import
**What goes wrong:** logger.ts overrides `console.*` methods globally (lines 197-211). If a file imports logger AND calls console.*, it might create unexpected behavior during the migration.
**Why it happens:** logger.ts wraps console but doesn't prevent direct calls.
**How to avoid:** The migration is one-directional: replace `console.*` with `logger.*`. After migration, the console overrides ensure any remaining calls still work.
**Warning signs:** Duplicate log lines or missing log context after partial migration.

## Code Examples

### index.ts Decomposition — Shared Image Serving Utility

```typescript
// Source: Extracted from server/src/index.ts lines 114-219
// server/src/services/imageFileService.ts

interface ImageServeOptions {
  fileType: 'event_face' | 'event_motion' | 'snapshot';
  fallbackSubDir: 'events/motion' | 'snapshots';
}

export class ImageFileService {
  private cache = new Map<string, string | null>();
  private cacheTimestamps = new Map<string, number>();
  private readonly POSITIVE_TTL = 300_000;
  private readonly NEGATIVE_TTL = 60_000;

  async findImagePath(filename: string, subDir: 'events/motion' | 'snapshots'): Promise<string | null> {
    // ... existing findImagePath logic from index.ts:48-91
  }

  async resolveImage(filename: string, options: ImageServeOptions): Promise<string | null> {
    // Shared DB lookup + fallback logic (deduplicates CQ-02)
    const dataSource = serviceRegistry.getAppDataSource();
    try {
      const results = await dataSource.query(
        `SELECT storage_path FROM detection_files
         WHERE original_filename = $1 AND file_type = ANY($2) AND is_deleted = FALSE
         ORDER BY created_at DESC LIMIT 1`,
        [filename, Array.isArray(options.fileType) ? options.fileType : [options.fileType]]
      );
      if (results.length > 0) {
        let imagePath = results[0].storage_path;
        if (!path.isAbsolute(imagePath)) {
          imagePath = path.join(process.cwd(), 'data', 'detections', imagePath);
        }
        if (await checkFileExists(imagePath)) return imagePath;
      }
    } catch (dbError: any) {
      console.warn('Database query failed, falling back to file system scan:', dbError.message);
    }
    return this.findImagePath(filename, options.fallbackSubDir);
  }
}
```

### nvidiaAnalysisService Decomposition — Public API Preservation

```typescript
// Source: server/src/services/nvidiaAnalysisService.ts
// The default export MUST be preserved:
// nvidia/index.ts (barrel file)
export { analyzeImage, checkApiHealth, analyzeWithBoundingBoxes, analyzePersons } from './nvidiaAnalysisFunctions.js';
export type { AnalysisContext, BoundingBox, PersonDetectionResult, BboxAnalysisResult, NvidianalysisResult, NvidiaApiError } from './types.js';

// This ensures existing consumers like NvidiaController.ts continue to work:
// import nvidiaAnalysis from '../services/nvidiaAnalysisService.js';
// (no change needed — the barrel file re-exports everything)
```

### Frontend Jest Config (Required — TEST-01)

```typescript
// frontend/jest.config.ts — DOES NOT EXIST YET, must create
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        module: 'ESNext',
        target: 'ES2020',
        moduleResolution: 'node',
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFilesAfterSetup: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.{test,spec}.{ts,tsx}', '**/*.{test,spec}.{ts,tsx}'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
};

export default config;
```

### Controller Test Pattern — AuthController (TEST-02)

```typescript
// Source: Pattern from existing server/src/routes/auth.test.ts + AuthController DI pattern
// server/src/controllers/__tests__/AuthController.test.ts

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AuthController } from '../AuthController.js';
import type { AuthService } from '../../auth/index.js';

// Mock dependencies
const mockAuthService = {
  login: jest.fn(),
  register: jest.fn(),
  getUserById: jest.fn(),
  verifyToken: jest.fn(),
  generateToken: jest.fn(),
  changePassword: jest.fn(),
} as unknown as jest.Mocked<AuthService>;

// Mock request/response
const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    controller = new AuthController(mockAuthService as any);
  });

  describe('login', () => {
    it('should return 401 for invalid credentials', async () => {
      mockAuthService.login = jest.fn().mockResolvedValue({ success: false, error: 'Invalid credentials' });
      const req = { body: { username: 'admin', password: 'wrong' } } as any;
      const res = mockRes();

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid credentials' });
    });
  });
});
```

### cacheService Test Pattern — TEST-03

```typescript
// Source: server/src/services/cacheService.ts (297 lines)
// Key test cases: Redis available vs fallback, TTL expiry, MAX_MEMORY_CACHE_SIZE eviction

describe('CacheService', () => {
  it('should fall back to memory cache when Redis unavailable', async () => {
    const cache = new CacheService({ host: 'nonexistent', port: 9999, ttl: 60 });
    await cache.connect(); // Will fail to connect to Redis
    await cache.set('key1', 'value1');
    const result = await cache.get('key1');
    expect(result).toBe('"value1"'); // JSON stringified
  });

  it('should expire entries after TTL', async () => {
    const cache = new CacheService({ ttl: 1 }); // 1 second TTL
    await cache.connect();
    await cache.set('key1', 'value1');
    await new Promise(r => setTimeout(r, 1100));
    const result = await cache.get('key1');
    expect(result).toBeNull();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flask single-file apps | Flask Blueprints | Flask 1.0+ (2017) | Standard for any Flask app > 5 routes |
| Enzyme for React testing | React Testing Library | 2019+ | RTL is the standard; Enzyme deprecated for React 18 |
| CommonJS jest configs | ESM jest configs with ts-jest | Jest 27+ (2021) | Project uses ESM throughout; ts-jest handles it |

**Deprecated/outdated:**
- `require()` in jest config: The project uses `export default` in server/jest.config.js. Frontend should follow the same pattern.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Frontend jest.config.ts will work with ts-jest given Vite's bundler moduleResolution | Frontend Tests | Tests won't run; may need `module: "commonjs"` override in ts-jest tsconfig |
| A2 | Python blueprints can share module-level globals from app.py via import | Python Decomposition | Circular imports or NameErrors if not carefully managed |
| A3 | nvidiaAnalysisService consumers only import from the default export | nvidia Decomposition | If consumers import individual functions by name, barrel file must also export them |
| A4 | index.ts tracking event handler (lines 384-443) should move to a separate socket setup module | index.ts Decomposition | If it depends on closure variables from initializeServices, extraction is more complex |
| A5 | The `import.meta.env.DEV` in baseClient.ts needs mocking in jest config | Frontend Tests | Tests that import baseClient will fail on env access |

**Risk assessment:** A1 is highest risk — frontend jest config with ESM + Vite aliases is a known pain point. Recommend creating jest config as first task and verifying it works before writing tests.

## Open Questions

1. **Frontend jest config path resolution**
   - What we know: Frontend uses `@/` path alias (tsconfig paths + vite resolve.alias). ts-jest needs explicit moduleNameMapper.
   - What's unclear: Whether `import.meta.env` needs a custom transformer or jest globals setup.
   - Recommendation: Create jest.setup.ts with `Object.defineProperty(globalThis, 'import.meta', { ... })` or use `globals` in ts-jest config.

2. **Python blueprint shared state pattern**
   - What we know: 6+ module-level globals used across routes. Flask blueprints need explicit state sharing.
   - What's unclear: Whether to use Flask `app.extensions`, a shared `state.py` module, or application context.
   - Recommendation: Use a `state.py` module that holds initialized instances — simplest pattern, matches existing code structure.

3. **eventSearchService decomposition depth**
   - What we know: 673L with 13 methods, most are SQL query builders with different filter combinations.
   - What's unclear: Whether query builder extraction is worth the added indirection vs. just reorganizing within the class.
   - Recommendation: Extract interfaces to types.ts, keep the class in one file but organize methods by category (search, history, stats, files). Full query builder extraction can be deferred.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend + Frontend | ✓ | v26.2.0 | — |
| npm | Package management | ✓ | 11.16.0 | — |
| Python 3 | OpenCV service decomposition | ✓ | 3.14.5 | — |
| PostgreSQL | Database (tests) | — (not needed for unit tests) | — | Mock with jest.mock() |
| Redis | cacheService tests | ✗ | — | Test in-memory fallback path only |
| Jest (server) | Backend tests | ✓ | ^30.2.0 | — |
| Jest (frontend) | Frontend tests | ✓ (needs config) | ^30.2.0 | — |
| supertest | Controller tests | ✓ | ^7.1.4 | — |

**Missing dependencies with no fallback:** None — all required tools are available.

**Missing dependencies with fallback:** Redis not available for cacheService integration tests. Test the in-memory fallback path only (which is the primary test target anyway — Redis is the optional enhancement).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (server) | Jest ^30.2.0 + ts-jest ^29.4.5 + supertest ^7.1.4 |
| Config file (server) | server/jest.config.js (ESM, ts-jest preset) |
| Framework (frontend) | Jest ^30.2.0 + ts-jest ^29.4.5 (config NOT YET CREATED) |
| Config file (frontend) | ❌ Wave 0 — must create frontend/jest.config.ts |
| Quick run command (server) | `cd server && node --experimental-vm-modules node_modules/.bin/jest --testPathPattern='<pattern>'` |
| Quick run command (frontend) | `cd frontend && npx jest --testPathPattern='<pattern>'` |
| Full suite command (server) | `cd server && node --experimental-vm-modules node_modules/.bin/jest` |
| Full suite command (frontend) | `cd frontend && npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CQ-01 | index.ts < 100 lines after decomposition | Manual verification | `wc -l server/src/index.ts` | ❌ Post-decomposition |
| CQ-02 | Event/snapshot serving deduplicated | Unit | Test imageFileService.resolveImage() | ❌ Wave 0 |
| CQ-03 | nvidiaAnalysisService split into modules | Manual verification | `ls server/src/services/nvidia/` | ❌ Post-decomposition |
| CQ-04 | app.py split into blueprints | Manual verification | `ls opencv-service/routes/` | ❌ Post-decomposition |
| CQ-05 | All console.* replaced with logger.* | Automated grep | `rg 'console\.(log|warn|error|debug|info)' server/src/ --glob '!*.test.ts'` | ❌ Post-migration |
| CQ-07 | No hardcoded Docker path | Unit | Test rtspManager uses config | ❌ Wave 0 |
| TEST-01 | Frontend has jest config + baseClient tests | Unit | `cd frontend && npx jest` | ❌ Wave 0 |
| TEST-02 | Controller tests pass | Unit | `cd server && node --experimental-vm-modules node_modules/.bin/jest --testPathPattern='AuthController|CameraController'` | ❌ Wave 0 |
| TEST-03 | cacheService tests pass | Unit | `cd server && node --experimental-vm-modules node_modules/.bin/jest --testPathPattern='cacheService'` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd server && node --experimental-vm-modules node_modules/.bin/jest --testPathPattern='<changed-area>'` or `cd frontend && npx jest --testPathPattern='<changed-area>'`
- **Per wave merge:** Full server suite + full frontend suite
- **Phase gate:** Full suites green, all console.* calls replaced, all monolithic files decomposed, `wc -l` checks pass

### Wave 0 Gaps
- [ ] `frontend/jest.config.ts` — ESM + jsdom + ts-jest config with @/ alias and import.meta.env mock
- [ ] `frontend/jest.setup.ts` — @testing-library/jest-dom matchers, global mocks
- [ ] `server/src/controllers/__tests__/AuthController.test.ts` — covers TEST-02 (login, register, refresh)
- [ ] `server/src/controllers/__tests__/CameraController.test.ts` — covers TEST-02 (CRUD, snapshots)
- [ ] `server/src/services/__tests__/cacheService.test.ts` — covers TEST-03 (Redis fallback, TTL, eviction)
- [ ] `frontend/src/__tests__/baseClient.test.ts` — covers TEST-01 (fetchWithRetry, token refresh, error handling)
- [ ] `frontend/src/__tests__/AuthContext.test.tsx` — covers TEST-01 (login/logout state, reducer)
- [ ] Framework install: `cd frontend && npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Tests verify login/register/refresh paths correctly handle auth |
| V5 Input Validation | yes | Controller tests verify input validation (missing fields, invalid inputs) |
| V7 Error Handling | yes | Decomposition must preserve error handling patterns; tests verify error responses |

### Known Threat Patterns for Decomposition + Testing

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in static routes | Tampering | Existing validation in index.ts (lines 117-122) must be preserved during extraction |
| Broken auth in controller tests | Spoofing | Test mocks must not bypass auth middleware in production code |
| Sensitive data in test files | Information Disclosure | Test files must use mock tokens/secrets, never real credentials |

## Sources

### Primary (HIGH confidence)
- Codebase investigation — all 4 monolithic files read and analyzed (index.ts 606L, nvidiaAnalysisService.ts 1064L, app.py 1693L, eventSearchService.ts 673L)
- Existing test infrastructure verified — server has 21 test files, jest.config.js, supertest; frontend has zero tests
- logger.ts API surface documented — 280 lines with structured logging, console override, helper methods
- Package registry verification — all recommended packages verified on npm registry

### Secondary (MEDIUM confidence)
- Flask Blueprint pattern [CITED: flask.palletsprojects.com/en/3.0.x/blueprints/] — standard decomposition approach
- Jest + ts-jest ESM configuration — based on existing working server/jest.config.js pattern

### Tertiary (LOW confidence)
- Frontend jest.config.ts with import.meta.env mocking — common pattern but untested in this project's exact Vite + ts-jest setup (flagged as assumption A1)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed (server) or well-known ecosystem standards (frontend testing)
- Architecture: HIGH — existing patterns in codebase are clear and well-structured for decomposition
- Pitfalls: HIGH — identified from codebase analysis (Python globals, ESM resolution, Vite aliases)
- Testing: MEDIUM — frontend jest config needs creation and may require iteration on import.meta.env handling

**Research date:** 2026-05-30
**Valid until:** 2026-06-30 (stable domain — decomposition and testing patterns don't change rapidly)
