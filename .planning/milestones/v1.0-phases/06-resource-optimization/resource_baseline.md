# Resource Baseline Documentation

**Created:** 2026-03-19
**System:** SentryVision Home Security System

## Baseline Measurements

### Container Resource Usage (Idle with 2 viewers)

| Container | CPU % | Memory | PIDs |
|-----------|-------|--------|------|
| sentryvision-backend | 71.32% | 897.5 MiB | 114 |
| sentryvision-opencv | 28.60% | 317.4 MiB | 24 |
| sentryvision-frontend | 0.06% | 155.1 MiB | 49 |
| sentryvision-postgres | 3.22% | 43.0 MiB | 8 |
| sentryvision-redis | 0.54% | 32.3 MiB | 6 |
| **Total** | **~103%** | **~1.45 GB** | **201** |

### FFmpeg Configuration

**Current Settings (from rtspManager.ts):**
```typescript
const ffmpegArgs = [
  "-loglevel", "error",
  "-rtsp_transport", "tcp",
  "-timeout", "5000000",
  "-err_detect", "ignore_err",
  "-fflags", "+discardcorrupt+genpts+genpts",
  "-max_delay", "1000000",
  "-probesize", "32768",
  "-analyzeduration", "500000",
  "-i", "[RTSP_URL]",
  "-f", "mjpeg",
  "-pix_fmt", "yuvj420p",
  "-vcodec", "mjpeg",
  "-q:v", "5",       // Quality level (2-31, lower = better)
  "-threads", "4",    // 4 threads per FFmpeg
  "-r", "4",          // 4 FPS
  "-vf", "scale=1920:1080",
  "pipe:1",
];
```

**Per-Camera Resource Consumption:**
- CPU: ~35% per camera (FFmpeg + overhead)
- Memory: ~80-120 MB per camera
- Threads: 4 per FFmpeg process

### Process Architecture

**Stream Manager Design:**
- Single shared FFmpeg process per camera (design intent)
- Multiple roles: detect, record, live
- Adaptive FPS based on viewer count
- Currently: 2 FFmpeg processes (one per camera)

### Bottlenecks Identified

1. **High CPU Usage (71%)**: FFmpeg encoding is CPU-intensive
2. **Memory bloat (897MB)**: Node.js + FFmpeg per camera
3. **No Docker resource limits**: Unlimited resource access
4. **Continuous streaming**: No stream-on-demand optimization
5. **High OpenCV CPU (28%)**: Detection running continuously

## Optimization Targets

| Metric | Current | Target (Low Resource) |
|--------|---------|------------------------|
| CPU | ~103% | <50% (1 core) |
| Memory | ~1.45 GB | <1.0 GB |
| Per-camera CPU | ~35% | ~15% |
| Per-camera Memory | ~120 MB | ~60 MB |

## Key Findings

1. **No Docker resource limits** - containers can use unlimited resources
2. **2 FFmpeg processes** - one per camera, 4 threads each
3. **OpenCV running continuously** - 28% CPU even when idle
4. **No adaptive quality** - always 1920x1080 @ 4fps
5. **No stream-on-demand** - streams run regardless of viewers

## Recommended Optimizations

1. **FFmpeg**: Reduce threads to 1, lower quality, reduce FPS
2. **Docker**: Add memory/CPU limits for constrained systems
3. **OpenCV**: Add motion-triggered detection (not continuous)
4. **Streaming**: Implement stream-on-demand with inactivity timeout
5. **Adaptive quality**: Scale resolution based on viewer count
