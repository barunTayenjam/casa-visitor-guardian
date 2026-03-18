# Research Summary: SentryVision Enhancements

## Key Findings

### Stack
**Core technologies confirmed:** OpenCV MOG2 (keep), FFmpeg (already in use), Web Push API (recommended), Redis pub/sub (available).

**Recommended additions:**
- Enhanced preprocessing for motion detection (blur, morphology)
- InsightFace or face_recognition library for better face matching
- Built-in storage management before video recording
- Web Push API for notifications (no external service needed initially)

### Table Stakes
1. **Improved detection accuracy** — Reduce false positives (P0)
2. **Event notifications** — Browser push notifications (P1)
3. **Event search/filters** — Date, camera, type filtering (P1)
4. **Better face matching** — Higher accuracy recognition (P2)

### Differentiators
- Video clip recording on events
- Smart alert prioritization
- Unknown face immediate alerts

### Watch Out For
1. **Over-sensitive detection** — Implement multi-frame validation before going live
2. **Storage bloat** — Retention policies MUST come before video recording
3. **Notification fatigue** — Allow granular user preferences
4. **Face recognition drift** — Maintain embedding quality over time
5. **Database performance** — Add indexes early, monitor query times

## Files
- `.planning/research/STACK.md` — Technology recommendations
- `.planning/research/FEATURES.md` — Feature categorization
- `.planning/research/ARCHITECTURE.md` — Component boundaries
- `.planning/research/PITFALLS.md` — Common mistakes to avoid

---
*Research synthesized: 2026-03-18*
