# SentryVision Streaming Investigation - Document Index

**Date:** March 23, 2026  
**Investigation:** 3 connections per camera, mobile streaming failure

---

## 📋 Quick Start

**Read in this order:**

1. **INVESTIGATION_SUMMARY.md** ← START HERE
   - Executive summary
   - Key findings
   - Quick overview

2. **FIXES_SUMMARY.md** ← IMPLEMENT THIS FIRST
   - Priority 1 critical fixes
   - Code-level changes
   - Testing checklist

3. **STREAMING_ANALYSIS.md** ← UNDERSTAND THE ISSUES
   - Detailed root cause analysis
   - Architecture breakdown
   - Issue evidence

4. **ARCHITECTURE_DIAGRAM.txt** ← VISUAL REFERENCE
   - Architecture diagrams
   - Connection flows
   - Before/after comparisons

---

## 📁 Document Details

### 1. INVESTIGATION_SUMMARY.md (13 KB)
**Purpose:** Executive summary and quick reference  
**Contents:**
- Current state (3 connections → mobile broken)
- 5 critical issues with severity ratings
- Key code locations (10 files)
- Recommended fixes (priority order)
- Testing checklist
- Long-term recommendations

**Best for:** Team leads, developers needing quick overview

### 2. FIXES_SUMMARY.md (14 KB)
**Purpose:** Implementation guide with code changes  
**Contents:**
- Priority 1 critical fixes (5 fixes)
- Priority 2 improvements (2 fixes)
- Before/after code for each fix
- Testing checklist
- Expected results

**Best for:** Developers implementing fixes

### 3. STREAMING_ANALYSIS.md (12 KB)
**Purpose:** Deep dive into root causes  
**Contents:**
- Current architecture overview
- Root cause analysis (6 issues)
- Connection flow diagrams
- Code location summary
- Recommended solutions

**Best for:** Understanding why issues occur

### 4. ARCHITECTURE_DIAGRAM.txt (40 KB)
**Purpose:** Visual architecture reference  
**Contents:**
- Backend architecture diagram
- Frontend architecture diagram
- Connection flow (step-by-step)
- Mobile failure analysis
- Recommended architecture diagrams
- Mobile optimization examples

**Best for:** Visual learners, system designers

---

## 🎯 Key Findings

### Current Problems:
| Environment | Connections Per Camera | Status |
|-------------|------------------------|---------|
| Desktop (Dev) | 3 | DDOS-like behavior |
| Desktop (Prod) | 2 | Inefficient |
| Mobile | 0-1 | Completely broken |

### Root Causes:
1. **React.StrictMode** - Double-mounts components (dev only)
2. **Component lifecycle** - Old components stay mounted when focusing
3. **No deduplication** - Duplicate requests not prevented
4. **Socket.io config** - Mobile-incompatible settings
5. **No mobile optimization** - No bandwidth/FPS adaptation

### Impact:
- Resource waste (duplicate FFmpeg processes)
- Poor mobile experience (no streams)
- Connection storms (multiple requests)
- Inflated viewer counts

---

## 🛠️ Fix Implementation

### Priority 1: Critical Fixes (1-2 days)

1. **Add request deduplication**
   - Files: `SocketService.ts`, `CameraContext.tsx`, `server/src/index.ts`
   - Time: 2-3 hours
   
2. **Fix mobile Socket.io config**
   - File: `SocketService.ts`
   - Time: 30 minutes
   
3. **Fix component lifecycle**
   - File: `AdaptiveCameraGrid.tsx`
   - Time: 1 hour
   
4. **Add backend room deduplication**
   - File: `server/src/index.ts`
   - Time: 30 minutes

### Priority 2: Improvements (1 day)

5. **Add mobile optimizations**
   - Files: Multiple
   - Time: 2-3 hours
   
6. **Handle StrictMode**
   - File: `main.tsx`
   - Time: 15 minutes

### Expected Results:
- Desktop: 1 connection per camera (down from 3)
- Mobile: 1 stable connection (up from 0)
- Resource usage: 50% reduction

---

## 📊 Files Modified

### Frontend (6 files):
1. `frontend/src/services/SocketService.ts` - Deduplication, mobile config
2. `frontend/src/contexts/CameraContext.tsx` - Stream tracking
3. `frontend/src/components/dashboard/CameraStream.tsx` - Mobile FPS
4. `frontend/src/components/live/AdaptiveCameraGrid.tsx` - Lifecycle fix
5. `frontend/src/pages/StreamDashboard.new.tsx` - No changes (reference)
6. `frontend/src/main.tsx` - StrictMode handling

### Backend (2 files):
1. `server/src/index.ts` - Room deduplication
2. `server/src/streams/rtspManager.ts` - No changes (reference)

---

## 🧪 Testing

### Manual Testing Steps:

1. **Desktop - Single Connection Test**
   ```
   1. Open DevTools → Network → WS tab
   2. Open Dashboard
   3. Verify: Only ONE WebSocket connection
   4. Request stream for camera 1
   5. Verify: Only ONE 'requestStream' message
   6. Switch to focused view
   7. Verify: No additional 'requestStream' messages
   ```

2. **Mobile - Connection Test**
   ```
   1. Open mobile browser (iOS/Android)
   2. Navigate to Dashboard
   3. Verify: Connection established
   4. Request stream for camera 1
   5. Verify: Stream loads successfully
   6. Check console: No "too many connections" errors
   ```

3. **Resource Usage Test**
   ```
   1. Monitor FFmpeg processes
   2. Open Dashboard with 2 cameras
   3. Expected: 2 FFmpeg processes (one per camera)
   4. NOT 4 or 6 processes
   ```

---

## 🚀 Long-Term Improvements

After critical fixes, consider:

### 1. Single Persistent Background Stream
- Start FFmpeg on server startup
- Keep running even with no viewers
- Instant stream start for clients

### 2. Connection Pooling
- One Socket.io connection per tab
- Multiplex all streams over single connection
- Use rooms for routing

### 3. Adaptive Quality
- Detect device type (mobile/desktop)
- Adjust FPS, resolution, quality
- Monitor bandwidth and battery

**Timeframe:** 1-2 weeks for full implementation

---

## 📞 Next Steps

1. **Review findings** with team (30 min)
2. **Create implementation plan** (1 hour)
3. **Implement Priority 1 fixes** (1-2 days)
4. **Test on desktop and mobile** (1 day)
5. **Implement Priority 2 fixes** (1 day)
6. **Deploy and monitor** (ongoing)

**Total estimated time:** 3-5 days for full fix

---

## 📚 Additional Resources

### Existing Documentation:
- `ARCHITECTURE_IMPROVEMENT_PLAN.md` - Previous architecture work
- `STREAMING_IMPROVEMENTS.md` - Earlier streaming improvements
- `STREAMING_IMPROVEMENTS_APPLIED.md` - Applied changes log
- `STREAMING_UI_UX_ENHANCEMENTS.md` - UI/UX improvements

### Configuration Files:
- `server/cameras.json` - Camera RTSP URLs
- `docker-compose.yml` - Service configuration
- `frontend/vite.config.ts` - Vite proxy setup

---

## ✅ Investigation Checklist

This investigation covered:

- [x] RTSP stream management code
- [x] Socket.io implementation
- [x] FFmpeg process management
- [x] Connection establishment flow
- [x] Desktop vs mobile differences
- [x] WebSocket vs transport methods
- [x] Component lifecycle issues
- [x] Request deduplication
- [x] Mobile compatibility
- [x] Code location mapping
- [x] Root cause analysis
- [x] Fix recommendations
- [x] Testing procedures
- [x] Long-term architecture

**Files examined:** 20+  
**Lines reviewed:** 5,000+  
**Issues found:** 6 critical/high  
**Fixes provided:** 7 with code examples

---

## 🎓 Lessons Learned

### What Went Wrong:
1. **No deduplication** at any layer (frontend, context, backend)
2. **Component lifecycle** not properly managed
3. **Mobile not considered** in Socket.io configuration
4. **Testing gaps** - mobile issues not caught earlier

### Best Practices for Future:
1. **Add deduplication** at every layer
2. **Test on mobile** early and often
3. **Monitor connections** in production
4. **Document component lifecycle** clearly
5. **Use unique keys** for dynamic components

---

## 📝 Summary

**Problem:** 3 connections per camera (DDOS-like), mobile streaming broken  
**Root Cause:** Multiple design flaws (deduplication, lifecycle, config)  
**Solution:** Targeted fixes to 8 files (Priority 1)  
**Timeframe:** 3-5 days for complete fix  
**Outcome:** 1 connection per camera, mobile working, 50% resource reduction

**Status:** ✅ Investigation complete, ready for implementation

---

**Last updated:** March 23, 2026  
**Documents:** 4 analysis files + this index  
**Total size:** ~80 KB of documentation  
**Ready to share:** Yes, distribute to team
