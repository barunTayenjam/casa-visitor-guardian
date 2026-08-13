# Codebase Structure

**Analysis Date:** 2026-08-13

## Directory Layout

```
[project-root]/
├── data/               # Persistent data (snapshots, detections, events)
├── database/           # DB migrations & initialization
├── frontend/           # React frontend source
├── opencv-service/     # Python-based computer vision service
├── server/             # Node.js Express backend source
└── public/             # Static public assets
```

## Directory Purposes

**`server/`:**
- Purpose: Backend API, streaming management, business logic
- Contains: `src/`, `dist/`, `scripts/`, `package.json`
- Key files: `src/index.ts` (entry), `src/bootstrap.ts` (init), `src/services/serviceRegistry.ts`

**`frontend/`:**
- Purpose: Web UI
- Contains: `src/`, `public/`, `package.json`, `vite.config.ts`
- Key files: `src/main.tsx` (entry), `src/App.tsx` (main)

**`opencv-service/`:**
- Purpose: Python computer vision processing
- Contains: ML models, RTSP ingestion, routes
- Key files: `rtsp_ingestion/`, `models/`

## Key File Locations

**Entry Points:**
- Server: `server/src/index.ts`
- Frontend: `frontend/src/main.tsx`

**Configuration:**
- Server: `server/src/config/index.ts`
- Docker: `docker-compose.dev.yml`

**Core Logic:**
- Streaming: `server/src/streams/rtspManager.ts`
- Detection: `server/src/detection/consolidatedDetectionService.ts`

**Testing:**
- Backend tests: `server/src/services/__tests__/`, `server/src/routes/*.test.ts`
- Frontend tests: `frontend/src/__tests__/`, `frontend/src/tests/`

## Naming Conventions

**Files:**
- TypeScript: `kebab-case.ts` / `PascalCase.tsx`
- Python: `snake_case.py`

**Directories:**
- `kebab-case`

## Where to Add New Code

**New Backend API:**
- Create file in `server/src/routes/`
- Add to `server/src/routes/index.ts`
- Add to `server/src/controllers/`

**New Backend Service:**
- Create in `server/src/services/`
- Register in `server/src/services/serviceRegistry.ts`
- Initialize in `server/src/bootstrap.ts`

**New Frontend Component:**
- `frontend/src/components/`

---

*Structure analysis: 2026-08-13*
