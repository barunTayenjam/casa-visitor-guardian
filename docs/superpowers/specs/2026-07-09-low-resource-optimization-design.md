# Low-Resource Optimization Design

**Date:** 2026-07-09  
**Target Hardware:** 4GB RAM, 4 CPU cores  
**Cameras:** 2-3 simultaneous  
**Approach:** Balanced Optimization (Approach 2)

---

## Executive Summary

Optimize SentryVision to run efficiently on a 4GB/4-core server with 2-3 cameras. The current configuration requests 6 CPU cores and 6GB RAM for OpenCV alone, exceeding the target hardware. This design reduces total resource usage by ~60% while maintaining detection quality through intelligent frame management and model selection.

---

## 1. Resource Allocation

### 1.1 Target Resource Distribution

| Service | Current | New | Savings |
|---------|---------|-----|---------|
| PostgreSQL | 0.5 CPU / 256MB | 0.5 CPU / 192MB | 64MB |
| Backend (Node.js) | 1.0 CPU / 1024MB | 1.0 CPU / 512MB | 512MB |
| OpenCV (Python) | 6.0 CPU / 4096MB | 2.0 CPU / 1536MB | 2560MB |
| go2rtc | 0.5 CPU / 128MB | 0.5 CPU / 128MB | 0MB |
| **Total** | **8.0 CPU / 5504MB** | **4.0 CPU / 2368MB** | **3136MB** |

### 1.2 Environment Variables

```bash
# docker-compose.yml overrides
POSTGRES_CPU_LIMIT=0.5
POSTGRES_MEM_LIMIT=192m
POSTGRES_MEM_RESERVE=64m

BACKEND_CPU_LIMIT=1.0
BACKEND_MEM_LIMIT=512m
BACKEND_MEM_RESERVE=128m

OPENCV_CPU_LIMIT=2.0
OPENCV_MEM_LIMIT=1536m
OPENCV_MEM_RESERVE=256m

GO2RTC_CPU_LIMIT=0.5
GO2RTC_MEM_LIMIT=128m
```

---

## 2. OpenCV/Python Optimizations

### 2.1 Dynamic Model Selection

**File:** `opencv-service/rtsp_ingestion/frame_pipeline.py`

```python
def select_model():
    """Select YOLO model based on available resources."""
    import torch
    import psutil
    
    gpu_available = torch.cuda.is_available()
    free_memory_gb = psutil.virtual_memory().available / (1024**3)
    
    if gpu_available:
        return 'yolov8n.onnx'  # Best accuracy with CUDA
    elif free_memory_gb > 2.0:
        return 'yolov8n.onnx'  # Acceptable on CPU with enough RAM
    else:
        return 'yolov5n.onnx'  # 30% faster inference, lower memory
```

**Model Priority Chain:**
1. `yolov8n.onnx` — GPU or CPU with >2GB free RAM
2. `yolov5n.onnx` — CPU with <2GB free RAM
3. `yolov4-tiny.onnx` — Fallback (existing behavior)

### 2.2 Frame Skipping Under Load

**Prerequisite:** Add `psutil>=5.9.0` to `opencv-service/requirements.txt`

**File:** `opencv-service/rtsp_ingestion/frame_pipeline.py`

```python
import psutil

class AdaptiveFrameProcessor:
    def __init__(self):
        self.cpu_threshold_high = 80  # Start skipping at 80% CPU
        self.cpu_threshold_low = 60   # Resume at 60% CPU
        self.skip_interval = 3        # Process every 3rd frame when skipping
        self.frame_count = 0
        self.is_skipping = False
        self.resume_timer = 0
    
    def should_process_frame(self):
        """Determine if current frame should be processed."""
        cpu_usage = psutil.cpu_percent(interval=0.1)
        
        if cpu_usage > self.cpu_threshold_high:
            self.is_skipping = True
            self.resume_timer = 0
        elif cpu_usage < self.cpu_threshold_low:
            self.resume_timer += 1
            if self.resume_timer > 5:  # 5 consecutive low readings
                self.is_skipping = False
        
        if self.is_skipping:
            self.frame_count += 1
            return self.frame_count % self.skip_interval == 0
        
        return True
```

**Behavior:**
- Normal mode: Process every frame (5 FPS detection)
- Load shedding: Process every 3rd frame (~1.7 FPS detection)
- Trigger: CPU usage > 80%
- Hysteresis: Requires CPU < 60% for 5 consecutive readings before resuming

### 2.3 Reduced Detection Resolution

**File:** `opencv-service/rtsp_ingestion/config.py`

```python
# Detection input resolution
DEFAULT_WIDTH = 480   # Down from 640
DEFAULT_HEIGHT = 480  # Down from 640

# JPEG encoding quality
JPEG_QUALITY = 60     # Down from 80
```

**Impact:**
- 44% fewer pixels to process (480×480 vs 640×640)
- ~25% smaller JPEG frames (quality 60 vs 80)
- Live stream remains 1280×720 for viewer quality

### 2.4 Python DB Pool Configuration

**File:** `opencv-service/pipeline.py`

```python
pool.SimpleConnectionPool(
    minconn=1,
    maxconn=3,              # Down from 5
    connect_timeout=5,      # Add timeout
    keepalives=1,           # Add keepalive
    keepalives_idle=30,     # Idle before keepalive
    options='-c statement_timeout=5000'  # 5s query timeout
)
```

### 2.5 YOLO Inference Optimization

**File:** `opencv-service/rtsp_ingestion/frame_pipeline.py`

```python
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError

class YOLOWrapper:
    def __init__(self):
        self._inference_lock = threading.Lock()
        self.inference_timeout = 5.0  # Max seconds per inference
    
    def detect(self, frame):
        """Run YOLO detection with timeout."""
        with self._inference_lock:
            try:
                # Use executor for timeout support
                with ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(self._model.detect, frame)
                    result = future.result(timeout=self.inference_timeout)
                    return result
            except TimeoutError:
                logger.warning("YOLO inference timed out, skipping frame")
                return []
```

---

## 3. Backend (Node.js) Optimizations

### 3.1 TypeORM Connection Pool

**File:** `server/src/database.ts`

```typescript
export const AppDataSource = new DataSource({
  // ... existing config
  poolSize: parseInt(process.env.DB_POOL_MAX || '5'),
  extra: {
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    max: parseInt(process.env.DB_POOL_MAX || '5'),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE || '10000'),
    acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE || '30000'),
  }
});
```

### 3.2 Cache Service Optimization

**File:** `server/src/services/cacheService.ts`

```typescript
const CACHE_CONFIG = {
  MAX_MEMORY_CACHE_SIZE: parseInt(process.env.CACHE_MAX_SIZE || '500'),  // Down from 2000
  CLEANUP_INTERVAL: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '60000'),  // 60s (down from 120s)
  DEFAULT_TTL: parseInt(process.env.CACHE_TTL || '1800'),  // 30 min (down from 1 hour)
};
```

### 3.3 Cron Job Optimization

**File:** `server/src/utils/cronJobs.ts`

```typescript
// Add job locking to prevent overlapping execution
const jobLocks = new Map<string, boolean>();

function withLock(jobName: string, fn: () => Promise<void>) {
  return async () => {
    if (jobLocks.get(jobName)) {
      logger.warn(`Job ${jobName} already running, skipping`);
      return;
    }
    jobLocks.set(jobName, true);
    try {
      await fn();
    } finally {
      jobLocks.set(jobName, false);
    }
  };
}

// Wrap existing jobs
cron.schedule('0 3 * * *', withLock('cleanup', async () => {
  await cleanupDetections();
}));

// Reduce health check frequency
cron.schedule('*/60 * * * *', withLock('healthcheck', async () => {  // Every 60 min (down from 30)
  await checkCameraHealth();
}));
```

### 3.4 Socket.io Memory Optimization

**File:** `server/src/index.ts`

```typescript
const io = new Server(httpServer, {
  maxHttpBufferSize: parseInt(process.env.SOCKET_MAX_BUFFER || '1e6'),  // 1MB (down from 100MB)
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT || '20000'),
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL || '25000'),
  transports: ['websocket'],  // Skip polling for lower overhead
});
```

### 3.5 Rate Limiting Adjustment

**File:** `server/src/middleware/enhancedRateLimit.ts`

```typescript
const RATE_LIMITS = {
  general: { windowMs: 15 * 60 * 1000, max: 200 },      // Down from 1000
  auth: { windowMs: 15 * 60 * 1000, max: 30 },           // Keep as-is
  stream: { windowMs: 60 * 1000, max: 10 },              // Down from 30
  detection: { windowMs: 60 * 1000, max: 20 },           // Keep as-is
};
```

---

## 4. Frontend Optimizations

### 4.1 Route-Based Code Splitting

**File:** `frontend/src/pages/App.tsx`

```typescript
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Lazy load routes
const Login = lazy(() => import('./Login'));
const EventsPage = lazy(() => import('./EventsPage'));
const Analytics = lazy(() => import('./Analytics'));
const Settings = lazy(() => import('./Settings'));
const DayHighlights = lazy(() => import('./DayHighlights'));
const StreamDashboard = lazy(() => import('./StreamDashboard'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/highlights" element={<DayHighlights />} />
          <Route path="/stream" element={<StreamDashboard />} />
          <Route path="/" element={<StreamDashboard />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

### 4.2 Vite Configuration Update

**File:** `frontend/vite.config.ts`

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-toast',
          ],
          charts: ['recharts'],
        }
      }
    },
    chunkSizeWarningLimit: 500,  // Warn if >500KB
  }
});
```

### 4.3 Image Lazy Loading

**File:** `frontend/src/components/events/EventCard.tsx`

```typescript
// Add lazy loading to detection images
<img
  src={event.imagePath}
  alt="Detection"
  loading="lazy"
  className="..."
/>
```

---

## 5. Database Optimizations

### 5.1 PostgreSQL Configuration Tuning

**File:** `docker-compose.yml`

```yaml
command: >
  postgres
    -c shared_buffers=${POSTGRES_SHARED_BUFFERS:-48MB}
    -c work_mem=${POSTGRES_WORK_MEM:-2MB}
    -c maintenance_work_mem=${POSTGRES_MAINTENANCE_WORK_MEM:-16MB}
    -c effective_cache_size=${POSTGRES_EFFECTIVE_CACHE_SIZE:-96MB}
    -c max_connections=${POSTGRES_MAX_CONNECTIONS:-15}
    -c random_page_cost=1.1
    -c effective_io_concurrency=200
    -c default_statistics_target=50
```

### 5.2 Connection Budget

| Component | Connections | Rationale |
|-----------|-------------|-----------|
| TypeORM pool | 5 max | Down from 10 |
| Python DB pool | 3 max | Down from 5 |
| Healthcheck | 1 | Steady |
| pg_isready | 1 | Steady |
| **Total peak** | 10 | Leaves 5 for maintenance |

### 5.3 Cleanup Optimization

**File:** `server/src/services/retentionPolicyService.ts`

```typescript
// Add batch deletion
async function cleanupOldEvents(retentionDays: number = 14) {
  const batchSize = 1000;
  let deleted = 0;
  
  while (true) {
    const result = await AppDataSource.query(`
      DELETE FROM events 
      WHERE id IN (
        SELECT id FROM events 
        WHERE timestamp < NOW() - ($1 || ' days')::interval
        LIMIT $2
      )
    `, [retentionDays, batchSize]);
    
    deleted += result.rowCount;
    if (result.rowCount < batchSize) break;
    
    // Yield to event loop between batches
    await new Promise(resolve => setImmediate(resolve));
  }
  
  logger.info(`Cleaned up ${deleted} old events`);
}
```

---

## 6. Implementation Priority

### Phase 1: Quick Wins (Day 1)
| Change | File | Risk | Impact |
|--------|------|------|--------|
| Reduce OpenCV CPU/memory limits | `docker-compose.yml` | Low | Frees ~2.5GB RAM |
| Reduce Backend memory limit | `docker-compose.yml` | Low | Frees ~512MB RAM |
| Configure TypeORM connection pool | `server/src/database.ts` | Low | Reduces DB memory |
| Reduce cache size (2000→500) | `server/src/services/cacheService.ts` | Low | Frees Node.js memory |

### Phase 2: Detection Optimization (Day 2)
| Change | File | Risk | Impact |
|--------|------|------|--------|
| Add `psutil` to requirements.txt | `opencv-service/requirements.txt` | Low | Enables CPU monitoring |
| Implement frame skipping under load | `opencv-service/rtsp_ingestion/frame_pipeline.py` | Medium | Prevents CPU saturation |
| Reduce detection resolution (640→480) | `opencv-service/rtsp_ingestion/config.py` | Low | ~44% fewer pixels |
| Add Python DB pool timeouts | `opencv-service/pipeline.py` | Low | Prevents hung connections |
| Dynamic model selection | `opencv-service/rtsp_ingestion/frame_pipeline.py` | Medium | Adapts to available resources |

### Phase 3: Frontend & Database (Day 3)
| Change | File | Risk | Impact |
|--------|------|------|--------|
| Add lazy route loading | `frontend/src/pages/App.tsx` | Medium | Faster initial load |
| Tune PostgreSQL memory settings | `docker-compose.yml` | Low | ~16MB savings |
| Adjust rate limits | `server/src/middleware/enhancedRateLimit.ts` | Low | Matches home-use patterns |
| Vite chunk splitting | `frontend/vite.config.ts` | Low | Smaller initial bundle |

### Phase 4: Monitoring & Testing (Day 4)
| Change | File | Risk | Impact |
|--------|------|------|--------|
| Add resource usage logging | Various | Low | Visibility into performance |
| Test with 2-3 cameras | — | — | Validate optimizations |
| Monitor CPU/memory under load | — | — | Identify remaining bottlenecks |

---

## 7. Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| **Total RAM usage** | ~6GB (exceeds 4GB) | ~2.5GB |
| **CPU allocation** | 8 cores requested | 4 cores (fits hardware) |
| **Initial page load** | Single bundle (~1MB) | Split bundles (~300KB first load) |
| **Detection under load** | CPU saturation, frame drops | Frame skipping, stable |
| **DB connections** | 15 peak | 10 peak |

---

## 8. Testing Strategy

### Unit Tests
- Test frame skipping logic with mocked CPU usage
- Test dynamic model selection with mocked system resources
- Test batch deletion with large datasets

### Integration Tests
- Run full pipeline with 2-3 cameras for 1 hour
- Monitor CPU/memory usage under sustained load
- Test detection accuracy at reduced resolution (480×480)

### Load Tests
- Simulate high CPU usage (80%+) and verify frame skipping activates
- Verify system recovers when CPU usage drops below 60%
- Test Socket.io connections with reduced buffer size

---

## 9. Rollback Plan

If optimizations cause issues:

1. **Immediate:** Revert `docker-compose.yml` to original resource limits
2. **Detection:** Set `DEFAULT_WIDTH=640`, `DEFAULT_HEIGHT=640`, `JPEG_QUALITY=80`
3. **Frame skipping:** Disable by setting `cpu_threshold_high=100`
4. **Frontend:** Remove lazy loading, rebuild without code splitting
5. **Database:** Restore original PostgreSQL config values

---

## 10. Success Criteria

- [ ] System runs on 4GB/4-core hardware without OOM kills
- [ ] Detection accuracy maintained within 5% of baseline
- [ ] Frontend loads in <2 seconds on slow connection
- [ ] CPU usage stays below 80% during normal operation
- [ ] No frame drops during steady-state detection
- [ ] Memory usage stable over 24-hour period
