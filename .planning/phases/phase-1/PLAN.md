# Phase 1 Plan: Detection Quality

**Phase:** 1
**Goal:** Reduce false positives, improve motion detection accuracy
**Requirements:** DET-01 to DET-05
**Created:** 2026-03-18

## Plans

### Plan 1.1: Multi-Frame Validation

**Requirement:** DET-01
**Task:** Implement multi-frame validation — require 2-3 consecutive motion frames before triggering event

**Steps:**
1. Add `frameBuffer` array to track recent frames
2. Modify detection logic to check if motion persists across 3 frames
3. Only trigger event when motion detected in 3 consecutive frames
4. Add cooldown to prevent rapid re-triggering
5. Add configuration option for frame count threshold

**Files:**
- `server/src/detection/optimizedMotionDetection.ts`
- `server/src/config/detectionConfig.ts`

**Verification:**
- [ ] Events only fire when motion in 3+ consecutive frames
- [ ] Single-frame glitches don't trigger events
- [ ] Detection latency < 1 second

---

### Plan 1.2: Preprocessing Pipeline

**Requirements:** DET-02, DET-05
**Task:** Add preprocessing pipeline — Gaussian blur, morphological operations, contour filtering

**Steps:**
1. Add Gaussian blur (kernel size 5x5) before MOG2
2. Add morphological operations (erode/dilate) to clean up contours
3. Filter contours by minimum area (configurable, default 500 pixels)
4. Filter out small contours that represent shadows/noise
5. Add time-of-day sensitivity multiplier

**Files:**
- `server/src/detection/optimizedMotionDetection.ts`
- `server/src/config/detectionConfig.ts`

**Verification:**
- [ ] Shadows don't trigger events
- [ ] Small movements (insects, leaves) filtered
- [ ] Clean contour data passed to event logic

---

### Plan 1.3: Adaptive Thresholds

**Requirements:** DET-03, DET-04
**Task:** Implement adaptive thresholds — time-of-day sensitivity, minimum contour area

**Steps:**
1. Add time-of-day sensitivity zones in config (day/night)
2. Implement higher sensitivity for night mode (22:00-06:00)
3. Add `minContourArea` configuration (default 500)
4. Add `sensitivityMultiplier` per time zone
5. Update config schema and cameras.json
6. Add API endpoint to adjust sensitivity at runtime

**Files:**
- `server/src/config/detectionConfig.ts`
- `server/cameras.json`
- `server/src/routes/index.ts` (for API endpoint)

**Verification:**
- [ ] Night mode has increased sensitivity
- [ ] Minimum contour area configurable
- [ ] Runtime sensitivity adjustment works

---

## Phase 1 Verification

After all plans complete:

1. **False positive test:** Run system for 24 hours, count events vs previous baseline
2. **Shadow test:** Direct flashlight at camera, should not trigger
3. **Small movement test:** Shake small branch near camera, should not trigger
4. **Real motion test:** Walk in front of camera, should trigger within 1 second
5. **Night test:** Verify night mode activates at 22:00

**Success Criteria:**
- Motion events reduce by >50% without missing real detections ✓
- Shadows and small movements filtered ✓
- Night mode sensitivity works correctly ✓
- Detection latency < 1 second ✓
- Multi-frame validation working ✓

---
*Phase 1 plan created: 2026-03-18*
