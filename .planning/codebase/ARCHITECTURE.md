# Architecture

> Generated: 2026-08-15 | Focus: Arch | Scope: full repo

## System Architecture

SentryVision is a multi-service home security system designed for robustness and low-latency stream processing.

### Layers

1.  **Frontend**: Vite/React SPA served statically from the backend. Real-time updates via Socket.io.
2.  **Backend API (Express 5)**: Central control, auth, API management, database orchestration (TypeORM), and stream coordination.
3.  **OpenCV Service (Flask)**: Dedicated computer vision microservice (`opencv-service/`) for motion detection, object tracking (ByteTracker), and face recognition (InsightFace).
4.  **go2rtc**: Dedicated media bridge for protocol conversion (RTSP to WebRTC/MSE).
5.  **Database**: PostgreSQL 15+, managed via TypeORM migrations.

### Data Flow

1.  **Live View**: `Frontend` connects to `go2rtc` directly (WebRTC/MSE) for streams, while `Node.js` manages stream authorization and `go2rtc` configuration.
2.  **Detection Pipeline**:
    -   `OpenCV Service` pulls RTSP frames via FFmpeg (`ffmpeg_reader.py`).
    -   Detection occurs locally in Python using object detection and face recognition models.
    -   Tracking/Event data + JPEG captures are sent to `Node.js` over WebSocket (`websocket_publisher.py`).
    -   `Node.js` persists events to PostgreSQL and broadcasts alerts via Socket.io.
3.  **Command Flow**: `Node.js` APIs (`/api/*`) trigger actions in Python via internal HTTP calls (`opencvMicroserviceClient.ts`) or `go2rtc` via proxy.

### Key Abstractions

-   **`Pipeline`**: Python-based real-time detection pipeline handles RTSP ingestion, motion gate, detection, and tracking. Node only receives events.
-   **`EventEmitter`**: Node.js `PythonWsClient` translates WebSocket events to Node events for application-wide alerts.
-   **`Service Registry`**: Central registry (`server/src/services/serviceRegistry.ts`) manages lifecycle of core application services.
-   **`Bootstrap`**: `server/src/bootstrap.ts` ensures ordered startup of service dependencies, database, and cron initialization.
