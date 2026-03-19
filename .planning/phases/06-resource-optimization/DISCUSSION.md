# Technical Discussion: Resource Optimization

## Context

SentryVision is designed as a full-featured home security system with real-time streaming, motion detection, and face recognition. Running this stack on constrained hardware (1 CPU core, 2GB RAM) requires careful optimization across all components.

## FFmpeg Resource Consumption Analysis

### Current Configuration
- Resolution: 1920x1080 (Full HD)
- Frame Rate: 4 FPS (streaming), 3 FPS (detection)
- Encoding: H.264 via libx264
- Processes: 1 per camera

### Resource Breakdown per FFmpeg Instance

| Component | CPU (cores) | Memory (MB) | Bandwidth |
|-----------|-------------|-------------|-----------|
| RTSP demux | 0.1 | 20 | - |
| Video decode | 0.3 | 50 | - |
| Resize | 0.05 | 10 | - |
| Encode (HD) | 0.4 | 30 | 8 Mbps |
| Encode (SD) | 0.15 | 20 | 1 Mbps |

**Total per camera (HD):** ~0.85 cores, ~110 MB  
**Total per camera (SD):** ~0.40 cores, ~70 MB

### Key Insights
1. **Encoding is the bottleneck**: H.264 encoding consumes 40-50% of CPU
2. **Resolution matters**: 640x360 uses 4x less CPU than 1920x1080
3. **FPS is linear**: Halving FPS roughly halves CPU usage
4. **Decoding is constant**: Always ~0.3 cores regardless of output

## OpenCV Detection Optimization Options

### Current Pipeline
1. Receive frame from backend
2. Preprocess (resize, normalize)
3. Run motion detection (MOG2)
4. Run object detection (YOLO)
5. Run face detection
6. Return results

### Optimization Approaches

#### Option A: Reduced Detection Frequency
- Run full detection every 3 seconds instead of every frame
- Motion detection on every frame (lightweight)
- Trade-off: Slightly slower response time

#### Option B: Cascade Processing
- First: Fast motion detection
- Second: If motion, run YOLO
- Third: If objects detected, run face detection
- Trade-off: More complex logic, but saves CPU

#### Option C: Frame Skipping
- Process every 3rd frame for detection
- Use frame differencing to interpolate
- Trade-off: May miss fast-moving objects

**Recommended**: Option B (Cascade) - Best balance of accuracy and performance

## Stream-on-Demand vs Continuous Streaming

### Continuous Streaming (Current)
```
[RTSP Camera] → [FFmpeg] → [RTMP/HLS] → [Clients]
                    ↓
            [Motion Detection]
```

**Pros:**
- Instant playback when user connects
- Consistent detection coverage
- Simpler architecture

**Cons:**
- Always consuming resources
- No viewer = wasted CPU cycles
- Memory accumulation over time

### Stream-on-Demand
```
[User Connects] → [Start FFmpeg] → [Stream to User]
                       ↓
              [Motion Detection]
                  ↓
           [Auto-stop after timeout]
```

**Pros:**
- Resources only when needed
- Scales with viewer count
- Lower baseline consumption

**Cons:**
- 2-3 second startup delay
- Complex state management
- Gap in detection coverage during startup

### Hybrid Approach (Recommended)
1. Always run low-resource detection stream (1 FPS, 320x240)
2. Start full-quality stream only when user connects
3. Auto-stop full stream after 5 minutes of inactivity
4. Maintain continuous motion detection

## Docker Resource Limits Approach

### Memory Limits
```yaml
services:
  backend:
    mem_limit: 512m
    mem_reservation: 256m
  
  opencv:
    mem_limit: 384m
    mem_reservation: 192m
  
  frontend:
    mem_limit: 256m
    mem_reservation: 128m
```

### CPU Limits
```yaml
services:
  backend:
    cpus: 0.5
    cpuset: "0"
  
  opencv:
    cpus: 0.3
    cpuset: "0"
  
  postgres:
    cpus: 0.2
    cpuset: "0"
```

### Critical Considerations

1. **PostgreSQL Memory**: Set `shared_buffers` to 64MB, disable huge pages
2. **Redis**: Limit `maxmemory` to 50MB, use eviction policy
3. **Node.js**: Set `--max-old-space-size=384` for backend
4. **Python**: Set `MPLbackend` to Agg, limit thread count

## Decision Matrix

| Approach | CPU Save | Memory Save | Latency | Complexity |
|----------|----------|-------------|---------|------------|
| SD Resolution | 50% | 30% | +0.5s | Low |
| Lower FPS | 40% | 10% | +0.5s | Low |
| Stream-on-Demand | 60% | 40% | +2s | Medium |
| Cascade Detection | 35% | 15% | +0.3s | Medium |
| All Combined | 80% | 60% | +1s | High |

## Implementation Strategy

1. **Phase 1**: Implement SD resolution for detection streams
2. **Phase 2**: Add stream-on-demand with inactivity timeout
3. **Phase 3**: Configure Docker limits and monitoring
4. **Phase 4**: Add UI controls and auto-optimization

## Open Questions

1. **Acceptable latency**: Is 2-3 second startup delay acceptable for viewing?
2. **Detection gaps**: Should we maintain continuous low-resource detection?
3. **Quality vs resources**: Prioritize HD quality or resource savings?
4. **Auto-tuning**: Should system auto-adjust based on load?

## References

- [FFmpeg Encoding Guide](https://trac.ffmpeg.org/wiki/Encode/H.264)
- [Docker Resource Constraints](https://docs.docker.com/config/containers/resource_constraints/)
- [OpenCV Performance Tuning](https://docs.opencv.org/4.x/d4/d13/tutorial_py_filtering.html)
