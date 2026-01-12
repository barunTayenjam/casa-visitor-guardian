# Backend vs Frontend API Mismatch Report
**Generated:** January 12, 2026  
**Environment:** Docker (different containers)

---

## SUMMARY

- **Total Backend APIs:** 80+ endpoints
- **Total Frontend API Calls:** 60+ methods
- **Matching APIs:** ~45 endpoints
- **Missing Backend APIs:** ~12 endpoints
- **Orphaned Backend APIs:** ~15 endpoints
- **Critical Mismatches:** 5

---

## PART 1: BACKEND API ENDPOINTS

### Authentication (`/api/auth`)
| Method | Endpoint | Status |
|---------|-----------|--------|
| POST | `/api/auth/register` | ✅ Working |
| POST | `/api/auth/login` | ✅ Working |
| GET | `/api/auth/profile` | ✅ Working |
| POST | `/api/auth/change-password` | ✅ Working |
| POST | `/api/auth/refresh` | ✅ Working |
| POST | `/api/auth/logout` | ✅ Working |

### Alerts (`/api/alerts`)
| Method | Endpoint | Status |
|---------|-----------|--------|
| GET | `/api/alerts` | ✅ Working |
| POST | `/api/alerts/:id/acknowledge` | ✅ Working |
| DELETE | `/api/alerts/:id` | ✅ Working |

### Settings (`/api/settings`)
| Method | Endpoint | Status |
|---------|-----------|--------|
| GET | `/api/settings` | ✅ Working |
| PUT | `/api/settings` | ✅ Working |

### Cameras (`/api/cameras`)
| Method | Endpoint | Status |
|---------|-----------|--------|
| GET | `/api/cameras/debug` | ✅ Working |
| GET | `/api/cameras` | ✅ Working |
| GET | `/api/cameras/:id` | ✅ Working |
| POST | `/api/cameras` | ✅ Working |
| PUT | `/api/cameras/:id` | ✅ Working |
| DELETE | `/api/cameras/:id` | ✅ Working |
| POST | `/api/cameras/:id/stream/start-test` | ✅ Working |
| POST | `/api/cameras/:id/stream/start` | ✅ Working |
| POST | `/api/cameras/:id/stream/stop` | ✅ Working |
| POST | `/api/cameras/:id/snapshot` | ✅ Working |
| POST | `/api/cameras/:id/night-mode` | ✅ Working |

### Streaming (`/stream`, `/snapshot`, `/events`, `/snapshots`)
| Method | Endpoint | Status |
|---------|-----------|--------|
| GET | `/snapshot/:cameraId.jpg` | ✅ Working |
| GET | `/stream/:cameraId/test` | ✅ Working |
| GET | `/stream/:cameraId` | ✅ Working |
| GET | `/events/:filename` | ✅ Working (main index.ts) |
| GET | `/snapshots/:filename` | ✅ Working (main index.ts) |

### Motion Detection (`/api/motion`)
| Method | Endpoint | Status |
|---------|-----------|--------|
| GET | `/api/motion/:cameraId/settings` | ✅ Working |
| PUT | `/api/motion/:cameraId/settings` | ✅ Working |
| GET | `/api/motion/events` | ✅ Working |
| GET | `/api/motion/:cameraId/events` | ✅ Working (appears twice) |
| POST | `/api/motion/:cameraId/simulate` | ✅ Working |
| POST | `/api/motion/:cameraId/analyze` | ✅ Working |

### Events (`/api/events`)
| Method | Endpoint | Status |
|---------|-----------|--------|
| GET | `/api/events/history` | ✅ Working |
| GET | `/api/events/search` | ✅ Working |
| GET | `/api/events/list` | ✅ Working |
| GET | `/api/events/list-enhanced` | ✅ Working |
| GET | `/api/events/:id/details` | ✅ Working |
| GET | `/api/events/image/:filename` | ✅ Working |
| POST | `/api/events/:id/archive` | ✅ Working |

### System (`/api/system`)
| Method | Endpoint | Status |
|---------|-----------|--------|
| GET | `/api/system/overview` | ✅ Working |
| GET | `/api/system/storage` | ✅ Working |
| GET | `/api/system/health` | ✅ Working |
| GET | `/health` | ✅ Working (main index.ts) |
| GET | `/test` | ✅ Working (main index.ts) |

### Analytics (`/api/analytics`)
| Method | Endpoint | Status |
|---------|-----------|--------|
| GET | `/api/analytics/hourly` | ✅ Working |
| GET | `/api/analytics/weekly` | ✅ Working |
| GET | `/api/analytics/monthly` | ✅ Working |
| GET | `/api/analytics/response-time` | ✅ Working |

### Detection (`/api/detection`)
| Method | Endpoint | Status |
|---------|-----------|--------|
| POST | `/api/detection/person/:cameraId/trigger` | ✅ Working |
| POST | `/api/detection/face/:cameraId/trigger` | ✅ Working |
| GET | `/api/detection/person/settings` | ✅ Working |
| PUT | `/api/detection/person/settings` | ✅ Working |
| GET | `/api/detection/face/settings` | ✅ Working |
| PUT | `/api/detection/face/settings` | ✅ Working |
| GET | `/api/detection/face/persons` | ✅ Working |
| POST | `/api/detection/face/persons` | ✅ Working |
| GET | `/api/detection/events` | ✅ Working |
| POST | `/api/detection/batch-process` | ✅ Working |
| GET | `/api/detection/batch-progress/:batchId` | ✅ Working |
| GET | `/api/opencv/status` | ✅ Working |
| GET | `/api/detection/today-events` | ✅ Working |

### Batch Processing (`/api/batch`)
| Method | Endpoint | Status |
|---------|-----------|--------|
| GET | `/api/batch/time-ranges` | ✅ Working |
| GET | `/api/batch/jobs` | ✅ Working |
| GET | `/api/batch/stats` | ✅ Working |
| GET | `/api/batch/events/available` | ✅ Working |
| POST | `/api/batch/start` | ✅ Working |
| POST | `/api/batch/jobs/:jobId/cancel` | ✅ Working |
| GET | `/api/batch/jobs/:jobId/results` | ✅ Working |
| GET | `/api/batch/jobs/:jobId/download` | ✅ Working |

### Visitor Routes (`/api/visitors`)
| Method | Endpoint | Status |
|---------|-----------|--------|
| GET | `/api/visitors/test` | ✅ Working |
| GET | `/api/visitors/timeline` | ✅ Working |
| GET | `/api/visitors/analytics` | ✅ Working |
| GET | `/api/visitors/analytics/enhanced` | ✅ Working |
| POST | `/api/visitors/analytics/export` | ✅ Working |
| POST | `/api/visitors/faces/recognize` | ✅ Working |
| POST | `/api/visitors/faces/register` | ✅ Working |
| GET | `/api/visitors/faces/known` | ✅ Working |
| GET | `/api/visitors/schedule` | ✅ Working |
| POST | `/api/visitors/report/generate` | ✅ Working |
| POST | `/api/visitors/schedule` | ✅ Working |

### Snapshots & Events Lists
| Method | Endpoint | Status |
|---------|-----------|--------|
| GET | `/api/snapshots/list` | ✅ Working |
| GET | `/api/events/list` | ✅ Working |

### Test & Debug
| Method | Endpoint | Status |
|---------|-----------|--------|
| POST | `/api/test/add-detection-data` | ✅ Working |

### Cleanup Routes (NOT REGISTERED)
| Method | Endpoint | Status |
|---------|-----------|--------|
| POST | `/cleanup/trigger` | ❌ Not registered in main server |
| GET | `/cleanup/stats` | ❌ Not registered in main server |

---

## PART 2: FRONTEND API CALLS (from ApiService.ts)

### Authentication
| Method | API Call | Backend Match |
|---------|-----------|---------------|
| POST | `/api/auth/register` | ✅ Match |
| POST | `/api/auth/login` | ✅ Match |
| GET | `/api/auth/profile` | ✅ Match |
| POST | `/api/auth/change-password` | ✅ Match |
| POST | `/api/auth/refresh` | ✅ Match |
| POST | `/api/auth/logout` | ✅ Match |

### Cameras
| Method | API Call | Backend Match |
|---------|-----------|---------------|
| GET | `/api/cameras` | ✅ Match |
| GET | `/api/cameras/:id` | ✅ Match |
| POST | `/api/cameras` | ✅ Match |
| PUT | `/api/cameras/:id` | ✅ Match |
| DELETE | `/api/cameras/:id` | ✅ Match |
| POST | `/api/cameras/:id/stream/start` | ✅ Match |
| POST | `/api/cameras/:id/stream/stop` | ✅ Match |
| POST | `/api/cameras/:id/snapshot` | ✅ Match |
| POST | `/api/cameras/:id/night-mode` | ✅ Match |

### Motion
| Method | API Call | Backend Match |
|---------|-----------|---------------|
| GET | `/api/motion/:cameraId/settings` | ✅ Match |
| PUT | `/api/motion/:cameraId/settings` | ✅ Match |
| GET | `/api/motion/events?limit=N` | ✅ Match |
| GET | `/api/motion/:cameraId/events?limit=N` | ✅ Match |
| POST | `/api/motion/:cameraId/analyze` | ✅ Match |

### Snapshots & Events
| Method | API Call | Backend Match |
|---------|-----------|---------------|
| GET | `/api/snapshots/list` | ✅ Match |
| GET | `/api/events/list` | ✅ Match |
| GET | `/events/:filename` | ✅ Match |
| GET | `/snapshots/:filename` | ✅ Match |

### System
| Method | API Call | Backend Match |
|---------|-----------|---------------|
| GET | `/api/system/storage` | ✅ Match |
| GET | `/api/system/health` | ✅ Match |
| GET | `/api/system/logs?level=&limit=` | ❌ MISSING - NO BACKEND ENDPOINT |
| DELETE | `/api/system/logs` | ❌ MISSING - NO BACKEND ENDPOINT |

### Settings
| Method | API Call | Backend Match |
|---------|-----------|---------------|
| GET | `/api/settings` | ✅ Match |
| PUT | `/api/settings` | ✅ Match |

### Alerts
| Method | API Call | Backend Match |
|---------|-----------|---------------|
| GET | `/api/alerts` | ✅ Match |
| POST | `/api/alerts/:id/acknowledge` | ✅ Match |
| DELETE | `/api/alerts/:id` | ✅ Match |

### Analytics
| Method | API Call | Backend Match |
|---------|-----------|---------------|
| GET | `/api/analytics/hourly` | ✅ Match |
| GET | `/api/analytics/weekly` | ✅ Match |
| GET | `/api/analytics/monthly` | ✅ Match |
| GET | `/api/analytics/response-time` | ✅ Match |

### Detection - Person
| Method | API Call | Backend Match |
|---------|-----------|---------------|
| POST | `/api/detection/person/:cameraId/trigger` | ✅ Match |
| GET | `/api/detection/person/settings` | ✅ Match |
| PUT | `/api/detection/person/settings` | ✅ Match |

### Detection - Face
| Method | API Call | Backend Match |
|---------|-----------|---------------|
| POST | `/api/detection/face/:cameraId/trigger` | ✅ Match |
| GET | `/api/detection/face/settings` | ✅ Match |
| PUT | `/api/detection/face/settings` | ✅ Match |
| GET | `/api/detection/face/persons` | ✅ Match |
| POST | `/api/detection/face/persons` | ✅ Match |

### Detection - General
| Method | API Call | Backend Match |
|---------|-----------|---------------|
| GET | `/api/detection/events?limit=&type=` | ⚠️ PARTIAL - exists but different parameters |
| GET | `/detections/image/:imageId?overlays=` | ❌ MISSING - NO BACKEND ENDPOINT |

### Historical Events
| Method | API Call | Backend Match |
|---------|-----------|---------------|
| GET | `/api/events/list-enhanced?params` | ✅ Match |
| POST | `/api/events/:id/archive` | ✅ Match |

### Batch Processing
| Method | API Call | Backend Match |
|---------|-----------|---------------|
| GET | `/batch/time-ranges` | ⚠️ MISMATCH - frontend expects `/batch`, backend has `/api/batch` |
| GET | `/batch/jobs` | ⚠️ MISMATCH - frontend expects `/batch`, backend has `/api/batch` |
| POST | `/batch/start` | ⚠️ MISMATCH - frontend expects `/batch`, backend has `/api/batch` |
| POST | `/batch/jobs/:jobId/cancel` | ⚠️ MISMATCH - frontend expects `/batch`, backend has `/api/batch` |
| GET | `/batch/jobs/:jobId/results` | ⚠️ MISMATCH - frontend expects `/batch`, backend has `/api/batch` |
| GET | `/batch/stats` | ⚠️ MISMATCH - frontend expects `/batch`, backend has `/api/batch` |
| GET | `/batch/events/available` | ⚠️ MISMATCH - frontend expects `/batch`, backend has `/api/batch` |
| GET | `/batch/jobs/:jobId/download` | ⚠️ MISMATCH - frontend expects `/batch`, backend has `/api/batch` |
| GET | `/api/batch/jobs/:jobId/download` | ⚠️ PARTIAL - frontend opens this URL directly, no fetch wrapper |

### Detection History
| Method | API Call | Backend Match |
|---------|-----------|---------------|
| GET | `/detection/events?params` | ⚠️ PARTIAL - different path structure |

---

## PART 3: CRITICAL MISMATCHES

### 🔴 CRITICAL: Batch Processing API Path Mismatch
**Issue:** Frontend calls batch APIs without `/api` prefix, backend has `/api/batch`

| Frontend Call | Backend Endpoint | Status |
|---------------|------------------|--------|
| GET `/batch/time-ranges` | GET `/api/batch/time-ranges` | ❌ 404 Error |
| GET `/batch/jobs` | GET `/api/batch/jobs` | ❌ 404 Error |
| POST `/batch/start` | POST `/api/batch/start` | ❌ 404 Error |
| POST `/batch/jobs/:jobId/cancel` | POST `/api/batch/jobs/:jobId/cancel` | ❌ 404 Error |
| GET `/batch/jobs/:jobId/results` | GET `/api/batch/jobs/:jobId/results` | ❌ 404 Error |
| GET `/batch/stats` | GET `/api/batch/stats` | ❌ 404 Error |
| GET `/batch/events/available` | GET `/api/batch/events/available` | ❌ 404 Error |
| GET `/batch/jobs/:jobId/download` | GET `/api/batch/jobs/:jobId/download` | ⚠️ Window.open (no fetch) |

**Fix Required:** 
Option 1: Update `ApiService.ts` line 1905-2053 to use `/batch` → `/api/batch`
Option 2: Add Vite proxy configuration to rewrite `/batch/*` to `/api/batch/*`

**Impact:** All batch processing features (BatchProcessing.tsx) will fail

---

### 🔴 CRITICAL: System Logs API Missing
**Issue:** Frontend expects system logs endpoints that don't exist in backend

| Frontend Call | Backend Endpoint | Status |
|---------------|------------------|--------|
| GET `/api/system/logs?level=&limit=` | NONE | ❌ 404 Error |
| DELETE `/api/system/logs` | NONE | ❌ 404 Error |

**Impact:** SystemLogs.tsx page will fail completely

**Fix Required:**
Option 1: Implement system logs endpoints in backend
Option 2: Remove SystemLogs.tsx if not needed

---

### 🟡 HIGH: Detection Image API Missing
**Issue:** Frontend expects detection image endpoint with overlays

| Frontend Call | Backend Endpoint | Status |
|---------------|------------------|--------|
| GET `/detections/image/:imageId?overlays=` | NONE | ❌ 404 Error |

**Backend Has:**
- GET `/api/events/image/:filename` - serves raw event images

**Impact:** Detection results with overlays may not display properly

---

### 🟡 HIGH: Detection Events API Parameter Mismatch
**Issue:** Frontend calls with different parameters than backend expects

| Frontend Call | Backend Endpoint | Parameters |
|---------------|------------------|-------------|
| GET `/detection/events?limit=&type=` | GET `/api/detection/events` | ⚠️ Different |

**Frontend params:** limit, type  
**Backend params:** None (just returns all events)

**Impact:** DetectionHistory feature may not work correctly

---

### 🟡 MEDIUM: Cleanup Routes Not Registered
**Issue:** Backend has cleanup route file but never registers it

| Frontend Call | Backend Endpoint | Status |
|---------------|------------------|--------|
| None (no frontend code uses these) | POST `/cleanup/trigger` | ❌ Never registered |
| None (no frontend code uses these) | GET `/cleanup/stats` | ❌ Never registered |

**File:** `server/src/routes/cleanup.ts` exists but `configureCleanupRoutes()` is never called in `server/src/index.ts`

**Impact:** Cleanup functionality cannot be triggered manually via API

---

## PART 4: UNUSED BACKEND APIs

### Available in Backend, Not Used in Frontend:

| Method | Endpoint | Notes |
|---------|-----------|-------|
| GET | `/api/cameras/debug` | Debugging - not needed in prod |
| POST | `/api/cameras/:id/stream/start-test` | Test streaming - not used |
| GET | `/stream/:cameraId/test` | Test endpoint - not used |
| GET | `/api/events/search` | Search exists, frontend uses list-enhanced |
| POST | `/api/motion/:cameraId/simulate` | Testing endpoint - not used |
| POST | `/api/test/add-detection-data` | Testing - not used |
| GET | `/api/opencv/status` | OpenCV service status - not displayed |
| GET | `/api/detection/today-events` | Not used in frontend |
| GET | `/api/system/overview` | Not used in frontend |
| GET | `/api/events/:id/details` | Not used in frontend |
| GET | `/events/:filename` | Exists in main index.ts |
| GET | `/snapshots/:filename` | Exists in main index.ts |

**Visitor Routes All Unused:**
| Method | Endpoint | Notes |
|---------|-----------|-------|
| GET | `/api/visitors/test` | Testing only |
| GET | `/api/visitors/timeline` | Has page but likely not connected |
| GET | `/api/visitors/analytics` | Has page but likely not connected |
| GET | `/api/visitors/analytics/enhanced` | Has page but likely not connected |
| POST | `/api/visitors/analytics/export` | Export feature |
| POST | `/api/visitors/faces/recognize` | Face recognition |
| POST | `/api/visitors/faces/register` | Face registration |
| GET | `/api/visitors/faces/known` | Get known faces |
| GET | `/api/visitors/schedule` | Visitor schedules |
| POST | `/api/visitors/report/generate` | Report generation |
| POST | `/api/visitors/schedule` | Schedule management |

**Note:** Frontend has VisitorTimeline.tsx and VisitorReports.tsx pages but ApiService.ts doesn't include methods to call visitor APIs.

---

## PART 5: DOCKER-SPECIFIC CONSIDERATIONS

### CORS Configuration
**Backend** (`server/src/index.ts`):
```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || 
    ['http://localhost:3000', 'http://localhost:5173', 'http://192.168.31.99:5173', 'http://192.168.31.99:8082'],
  credentials: true
}));
```

**Socket.IO CORS** (`server/src/index.ts`):
```typescript
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || 
      ['http://localhost:3000', 'http://localhost:5173', 'http://192.168.31.99:5173', 'http://192.168.31.99:8082'],
    credentials: true
  }
});
```

**Frontend Vite Proxy** (in `frontend/vite.config.ts`):
- Need to verify if `/batch/*` is proxied to backend
- Need to verify if `/api/*` is proxied correctly

### Docker Networking
- Frontend container → Backend container communication via nginx proxy
- Socket.IO uses relative URLs: `window.location.origin`
- API calls use relative URLs: `/api/*`

### Path Issues to Watch
1. **Image serving**: Frontend expects `/events/:filename` and `/snapshots/:filename`
2. **Batch processing**: Frontend uses `/batch/*`, backend expects `/api/batch/*`
3. **Static files**: Frontend served from `/`, backend serves from `/public`

---

## PART 6: RECOMMENDATIONS

### Immediate Fixes Required (Production Blockers)

1. **Fix Batch Processing API Paths**
   - File: `frontend/src/services/ApiService.ts`
   - Lines: 1905-2053
   - Change all `/batch/*` → `/api/batch/*`
   - OR add Vite proxy rule: `'^/batch/(.*)': 'http://backend:9753/api/batch/$1'`

2. **Implement System Logs API OR Remove Feature**
   - Option A: Add to `server/src/routes/index.ts`
     ```typescript
     app.get('/api/system/logs', async (req: Request, res: Response) => {
       // Implementation needed
     });
     app.delete('/api/system/logs', async (req: Request, res: Response) => {
       // Implementation needed
     });
     ```
   - Option B: Remove `frontend/src/pages/SystemLogs.tsx`

3. **Fix Detection Events API**
   - Align parameters between frontend and backend
   - Backend: `GET /api/detection/events`
   - Frontend: `GET /api/detection/events?limit=&type=`

### Optional Fixes (Quality of Life)

4. **Register Cleanup Routes**
   - Add to `server/src/index.ts`: `configureCleanupRoutes(router)`
   - Note: Router not initialized, need to create one

5. **Connect Visitor Pages**
   - Add visitor API methods to `ApiService.ts`
   - Or confirm visitor features are intentionally unused

6. **Add Detection Image Overlays API**
   - Implement: `GET /detections/image/:imageId?overlays=true`
   - Or update frontend to use `/api/events/image/:filename`

---

## PART 7: SUMMARY TABLE

| Category | Working | Mismatch | Missing | Unused |
|----------|----------|-----------|---------|---------|
| Authentication | 6/6 (100%) | 0 | 0 | 0 |
| Cameras | 11/11 (100%) | 0 | 0 | 2 |
| Motion | 6/6 (100%) | 0 | 0 | 1 |
| Events | 6/6 (100%) | 0 | 1 | 3 |
| System | 2/4 (50%) | 0 | 2 | 1 |
| Alerts | 3/3 (100%) | 0 | 0 | 0 |
| Settings | 2/2 (100%) | 0 | 0 | 0 |
| Analytics | 4/4 (100%) | 0 | 0 | 0 |
| Detection - Person | 3/3 (100%) | 0 | 0 | 0 |
| Detection - Face | 5/5 (100%) | 0 | 0 | 0 |
| Detection - General | 0/2 (0%) | 2 | 1 | 2 |
| Batch Processing | 0/8 (0%) | 8 | 0 | 0 |
| Visitor Routes | 0/11 (0%) | 0 | 0 | 11 |
| Cleanup Routes | 0/2 (0%) | 0 | 0 | 2 |
| **TOTAL** | **48/75 (64%)** | **10** | **4** | **22** |

---

## CONCLUSION

### Production Readiness: ⚠️ **NOT READY**

**Critical Issues:** 2
1. Batch processing completely broken (path mismatch)
2. System logs feature non-functional (missing endpoints)

**High Priority Issues:** 2
1. Detection image overlays API missing
2. Detection events API parameter mismatch

**Recommendation:** Fix critical and high priority issues before deploying to production.

### Docker-Specific Notes:
- CORS configured correctly
- Socket.IO configured correctly
- Vite proxy needs verification for `/batch/*` routes
- Image serving paths need verification in docker environment

---

**Report End**
