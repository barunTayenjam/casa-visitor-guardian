# Stack Research: SentryVision Enhancements

## Current Stack

**Frontend:** React 18, TypeScript, Vite, TailwindCSS, Radix UI, React Query, Socket.io
**Backend:** Node.js, Express, TypeScript, TypeORM, PostgreSQL, Socket.io
**OpenCV:** Python Flask, OpenCV (cv2), face_recognition library
**Infrastructure:** Redis (cache), PostgreSQL (database)

## Recommended Additions for Enhancements

### Motion Detection Improvements

**Library: OpenCV with enhanced algorithms**
- Use OpenCV's MOG2 (current) with better parameter tuning
- Consider OpenCV's K-Nearest Neighbors (KNN) as alternative
- Add temporal filtering (multiple frames consensus)

**Recommended: Keep existing MOG2, enhance with:**
- Gaussian blur preprocessing (reduce noise)
- Morphological operations (erode/dilate)
- Contour area thresholds (adaptive)
- Frame differencing for rapid motion

### Face Recognition Improvements

**Library: face_recognition (dlib) or InsightFace**
- Current: Custom embedding system
- Upgrade: Pre-trained face recognition models (InsightFace, ArcFace)

**Recommended additions:**
```python
# InsightFace for better accuracy
pip install insightface
# Or face_recognition for simpler setup
pip install face_recognition
```

### Notification System

**Push Notifications:**
- Web Push API (for browser notifications)
- Firebase Cloud Messaging (FCM) for mobile
- OneSignal for multi-platform

**Recommended: Web Push API first**
- Works in modern browsers
- No server required for basic implementation
- Can upgrade to FCM later

### Video Recording

**Library: FFmpeg (already in use)**
- Current: Frame capture as images
- Add: H.264/H.265 video segments
- Clip length: 30 seconds to 5 minutes per event

**Recommended approach:**
```bash
# Record 30-second clips on motion
ffmpeg -i rtsp://camera -t 30 -c:v libx264 output.mp4
```

### Storage Management

**Retention Policies:**
- Events: 30-90 days
- Videos: 7-14 days
- Images: 30 days

**Cleanup Tools:**
- Python script with shutil for file management
- PostgreSQL vacuum for database cleanup
- Cron job for automated cleanup

## What NOT to Use

| Avoid | Reason |
|-------|--------|
| TensorFlow Object Detection | Overkill for home security, too heavy |
| YOLO v5+ | Current detection is sufficient |
| Cloud storage (S3) | Not in scope, local only |
| Mobile native apps | Web-only for now |

## Confidence Levels

| Technology | Confidence | Notes |
|------------|------------|-------|
| MOG2 enhancements | High | Proven, stable |
| FFmpeg video recording | High | Already in use |
| Web Push API | High | Standard, well-supported |
| InsightFace | Medium | Better accuracy, requires model files |
| Redis-based cleanup | High | Simple, effective |

---
*Research completed: 2026-03-18*
