## SentryVision v1.4.0 Release Notes

### Highlights

**NVIDIA AI Analysis (Brain Icon) — Fixed**
- Fixed image path resolution in the NVIDIA analysis endpoint that prevented the brain icon on the Events page from working
- Added comprehensive path resolution supporting both Docker container paths (`/app/data/`) and non-Docker host paths
- Added LAN IP (`192.168.31.99`) to Vite allowedHosts for proper access from local network

**Event Filters — Redesigned**
- Simplified and compacted event filter UI on the Events page
- Improved filter layout for better usability

---

### New Features
- App-wide UI/UX consistency phase — shared `PageHeader`, `StatCard`, `PageLoading`, `EmptyState` components
- Dark/Light theme system with WCAG AA compliance and system preference detection
- Progressive image loading with LQIP blur effect
- Mobile-first responsive design with 44px touch targets and swipe gestures
- Stream quality indicator with live metrics
- Severity-based motion alert system with grouping and quick actions
- Stream Panel slide-up drawer with connection status, metrics, and recent detections
- Smooth swipe camera switching with slide transitions
- NVIDIA LLM integration with bounding box and person detection
- Always-on detection — auto-start detect stream on init
- Client-side bounding box overlay for batch detection results
- Batch detection UI with visitor-relevant class filtering (person, car, dog, bicycle)

### Security
- Auth middleware hardening with path traversal protection
- Removed hardcoded secrets
- Zod input validation for API endpoints
- PostgreSQL-backed rate limiting
- RTSP credential encryption infrastructure
- Typed `ServiceRegistry` replacing `(global as any)` pattern

### Performance
- Events list query optimization
- LOW_RESOURCE_MODE with optimized detection config
- Frontend request deduplication
- Stream auto-reconnect on page focus/visibility change and socket reconnect
- Dashboard stream flicker prevention with debounce/cooldown and exponential backoff

### Refactoring
- God file split — extracted route groups into domain-specific modules
- API service monolith split — shared base client with error handling and auth interceptor
- Removed 32+ dead backend files (~11,700 lines) and 29 unused shadcn/ui components
- Unit tests for InMemoryStateService, logger, configuration, and motion detection utilities
- `InMemoryStateService` for typed in-memory state

### Bug Fixes
- NVIDIA brain icon analysis — image path resolution for Docker/non-Docker deployments
- Stream reconnection on device wake and socket reconnect
- SQL INTERVAL syntax for cache cleanup
- TypeScript and build issues
- OOM prevention and missing imports
- Event image path extraction in API responses
- Confidence values returning realistic percentages

### Infrastructure
- Docker volume mounts for live code reload
- Health monitoring with auto-restart
- FFmpeg-based RTSP dual-stream architecture (stream + detect)
- Node.js memory optimization for resource-constrained systems

---

**Full Changelog**: 234 commits since v1.3
