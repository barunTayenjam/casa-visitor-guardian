# Camera DDOS Analysis and Prevention

## What Caused the DDOS:

### 1. **Aggressive Auto-Starting**
- System auto-starts ALL camera streams simultaneously on server startup
- Multiple ffmpeg processes hitting cameras at once
- No staggered startup or rate limiting

### 2. **Aggressive Retry Logic**
- Immediate retries on failure (5-10 seconds)
- Multiple retry attempts without exponential backoff
- Continuous hammering when cameras are struggling

### 3. **Resource-Intensive FFmpeg Settings**
- High probe sizes (5MB) and analysis duration (3 seconds)
- Multiple simultaneous connection attempts
- High frame rates (15 fps) and resolutions (1920x1080)

### 4. **Multiple Connection Types**
- TCP connections with long timeouts
- HTTP polling for camera status
- WebSocket connections for streaming
- All happening simultaneously

### 5. **No Connection Pooling**
- Each component creates its own connections
- No shared connection state
- Redundant parallel connections

## Prevention Strategy:

### 1. **Gentle Startup**
- Stagger camera initialization (30 seconds between cameras)
- Start with low-quality streams first
- Gradually increase quality after successful connection

### 2. **Exponential Backoff**
- Start with 30-second retry delay
- Double delay on each failure
- Maximum 5-minute delay between retries

### 3. **Connection Rate Limiting**
- Limit to 1 connection attempt per camera per minute
- Global connection rate limiting across all cameras
- Circuit breaker pattern for failing cameras

### 4. **Resource-Conservative Settings**
- Start with 1-2 fps, 640x480 resolution
- Minimal probe sizes (100KB)
- Short timeouts (10 seconds)

### 5. **Health Monitoring**
- Ping cameras before attempting RTSP
- Monitor camera response times
- Automatically reduce quality if cameras struggle

### 6. **Graceful Degradation**
- Fall back to lower quality on errors
- Implement "recovery mode" with minimal settings
- Temporary camera suspension after repeated failures