# Pitfalls Research: SentryVision Enhancements

## Common Pitfalls in Home Security Systems

### 1. Over-Sensitive Motion Detection

**Warning Signs:**
- Events spike during night without clear cause
- "Motion detected" but no objects visible
- Users start ignoring notifications

**Prevention:**
- Implement frame averaging before diff
- Add minimum contour area threshold
- Use adaptive sensitivity based on time
- Require 2-3 consecutive frames before trigger

**Phase Mapping:** Phase 1 (Detection Improvements)

---

### 2. Storage Bloat

**Warning Signs:**
- Disk space warning alerts
- `data/` directory growing rapidly
- Cleanup not keeping up with new files

**Prevention:**
- Implement retention policies BEFORE adding video recording
- Set hard limits on storage usage
- Monitor disk usage in dashboard
- Test cleanup with production data volume

**Phase Mapping:** Phase 4 (Storage & Video)

---

### 3. Face Recognition Degradation

**Warning Signs:**
- Known visitors marked as "unknown"
- Recognition confidence dropping over time
- False positive matches increasing

**Prevention:**
- Don't overwrite embeddings on same person
-定期清理低质量的人脸样本
- Use high-quality reference images
- Log and review recognition failures

**Phase Mapping:** Phase 3 (Face Recognition)

---

### 4. Notification Fatigue

**Warning Signs:**
- Users disable all notifications
- Important events missed
- Low engagement with alerts

**Prevention:**
- Allow granular notification preferences
- Group similar events (don't notify every frame)
- Add "do not disturb" periods
- Smart prioritization (unknown > known)

**Phase Mapping:** Phase 2 (Notifications)

---

### 5. Video Storage Complexity

**Warning Signs:**
- Video files corrupt or unplayable
- Storage grows faster than expected
- FFmpeg processes crashing

**Prevention:**
- Test with short clips first (10-30 seconds)
- Validate video integrity after recording
- Monitor FFmpeg error logs
- Use standard codecs (H.264, not HEVC)

**Phase Mapping:** Phase 4 (Storage & Video)

---

### 6. Database Query Performance

**Warning Signs:**
- Event list loading slowly
- Timeline queries timeout
- Database CPU high

**Prevention:**
- Add indexes on timestamp, camera_id, event_type
- Use pagination for event lists
- Archive old events to separate table
- Redis cache for frequent queries

**Phase Mapping:** All phases (ongoing)

---

### 7. OpenCV Service Bottleneck

**Warning Signs:**
- Detection latency increasing
- Frame drops in stream
- Memory usage growing

**Prevention:**
- Limit concurrent detection requests
- Use threading for non-blocking operations
- Restart service periodically (memory leak prevention)
- Monitor service health in dashboard

**Phase Mapping:** Phase 1 (Detection Improvements)

---

## Quick Reference

| Pitfall | Impact | Prevention | Phase |
|---------|--------|------------|-------|
| Over-sensitive detection | False alerts | Multi-frame validation | 1 |
| Storage bloat | Disk full | Retention policies first | 4 |
| Face degradation | Trust issues | Quality embeddings | 3 |
| Notification fatigue | Ignored alerts | Granular prefs | 2 |
| Video corruption | Lost footage | Test + validation | 4 |
| DB performance | Slow UI | Indexes + cache | All |
| OpenCV bottleneck | Detection lag | Resource limits | 1 |

---
*Research completed: 2026-03-18*
