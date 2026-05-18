# Phase 6: Resource Optimization

**Status:** Planned  
**Target System:** 1 CPU Core, 2GB RAM with 2+ cameras  
**Last Updated:** March 19, 2026

## Overview

Optimize the SentryVision system to run efficiently on constrained hardware while maintaining reliable security monitoring capabilities.

## Requirements

### Performance Targets
| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| CPU Usage | <50% | <70% |
| Memory Usage | <1.5GB | <1.8GB |
| Concurrent Cameras | 2+ | 2 |
| Detection Latency | <3s | <5s |
| Stream FPS | 2-4 fps | 1 fps minimum |

### Functional Requirements
- **RO-01**: System must operate within 2GB RAM constraints
- **RO-02**: Support 2 cameras simultaneously without degradation
- **RO-03**: Maintain motion detection reliability
- **RO-04**: Preserve face recognition capability
- **RO-05**: Enable graceful degradation under load

### Quality Targets
- **RQ-01**: Detection accuracy maintained at >90%
- **RQ-02**: Stream latency <3 seconds
- **RQ-03**: No dropped frames under normal operation
- **RQ-04**: Auto-recovery from resource exhaustion

## Technical Components

### 1. FFmpeg Optimization (6.2)
- Resolution scaling (1920x1080 → 640x360 for detection)
- FPS reduction (4fps → 2fps for streams)
- Hardware acceleration hints
- Low-resource encoding presets

### 2. Streaming Strategy (6.3)
- Stream-on-demand activation
- Inactivity timeout auto-shutdown
- Adaptive quality scaling
- Motion-triggered high-quality capture

### 3. Docker & Infrastructure (6.4)
- Container memory limits
- CPU pinning/cgroups
- Node.js memory optimization
- SWAP configuration

### 4. Configuration & UI (6.5)
- LOW_RESOURCE_MODE environment variable
- Camera quality presets
- Resource usage dashboard
- Auto-optimization toggle

## Dependencies

- Phase 1: Detection quality baseline
- Phase 3: Face recognition pipeline
- Phase 5: Frontend enhancements

## Deliverables

1. [ ] 06-resource-optimization/REQUIREMENTS.md (this file)
2. [ ] 06-resource-optimization/DISCUSSION.md
3. [ ] 06-resource-optimization/6.1-PLAN.md - Analysis & Audit
4. [ ] 06-resource-optimization/6.2-PLAN.md - FFmpeg Optimization
5. [ ] 06-resource-optimization/6.3-PLAN.md - Streaming Strategy
6. [ ] 06-resource-optimization/6.4-PLAN.md - Docker & Infrastructure
7. [ ] 06-resource-optimization/6.5-PLAN.md - Configuration & UI
8. [ ] Implementation of all plans
9. [ ] Resource usage benchmarks
10. [ ] Verification report

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Detection accuracy loss | High | Keep detection resolution at 640x360 minimum |
| Stream freezing | Medium | Implement graceful degradation |
| Memory leaks | High | Add memory monitoring and auto-restart |
| Detection latency spike | Medium | Implement detection queue with priority |

## Success Criteria

- [ ] CPU usage sustained <50% during normal operation
- [ ] Memory usage <1.5GB with 2 active streams
- [ ] No detection failures due to resource constraints
- [ ] Graceful degradation when approaching limits
- [ ] UI clearly shows resource status
