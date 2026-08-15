# Technical Concerns

> Generated: 2026-08-15 | Focus: Concerns | Scope: full repo

## Architecture Concerns

- **Node.js as Stream Coordinator**: Node.js acts as the single point of failure for stream initiation. Tablets fail to stream when Node is down because Node initiates the `requestStream` signal that triggers the Python `FFmpegReader`.
- **Scaling Limit**: Node.js acting as a JPEG relay or stream-start coordinator is a bottleneck for high-concurrency streaming.
- **WebRTC/MSE Tablet Issues**: Tablet playback failures occur due to internal Docker/localhost IP ICE candidates and lack of STUN/TURN configuration.

## Known Issues

- **Offline Camera Detection**: System health checks report camera offline status but don't automatically restart failed streams.
- **Stream Inactivity Timeout**: `STREAM_INACTIVITY_TIMEOUT` (300s) may be too aggressive for low-traffic cameras.
- **Python Service Restart**: OpenCV service doesn't auto-restart on crash (handled by Docker restart but not graceful).
- **Memory Pressure**: High-resolution camera streams (1920x1080) can cause memory pressure on low-end hardware.

## Security Considerations

- **Credential Exposure**: RTSP credentials stored in `server/cameras.json` (gitignored but requires secure storage).
- **JWT Secrets**: Access/refresh secrets in `.env` (production should use secret management).
- **API Token**: `OPENCV_API_TOKEN` shared between Node and Python services (should be rotated).

## Performance Concerns

- **Detection Pipeline Latency**: Python pipeline runs at 5 FPS (640x360) — higher resolution impacts performance.
- **Model Loading**: YOLO and InsightFace models load at startup; cold starts may delay first detection.
- **Database Indexing**: Event search performance depends on proper indexing (26 migrations include search indexes).
- **Redis Optional**: In-memory cache used when Redis is disabled, potentially impacting high-load scenarios.

## Maintenance Concerns

- **Model Updates**: Vision models require manual updates (no auto-update mechanism).
- **Configuration Drift**: Camera configurations stored in `server/cameras.json` (not version-controlled).
- **Dependency Management**: Python dependencies in `opencv-service/requirements.txt` require manual updates.
- **Secret Management**: Environment variables contain sensitive data (production should use vault/secrets manager).