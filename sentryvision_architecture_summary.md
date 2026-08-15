The system utilizes a multi-component architecture:

**1. Events and Detection:**
   - **Python OpenCV Service:** This external service performs real-time motion, object (YOLO), and face (InsightFace) detection on RTSP streams. It publishes detection events and raw video frames via WebSockets.
   - **`server/src/pipeline/detectionPersistence.ts`:** Receives `TrackingEvent`s from the Python service. It persists these events to the PostgreSQL `events` table and saves corresponding JPEG snapshots to disk.
   - **`server/src/services/detection/detectionService.ts`:** Filters and normalizes raw detection data using configurable thresholds and label mappings before further processing and persistence.
   - **`Event` Model:** Stores comprehensive details for each detected event, including type, severity, camera ID, file paths, timestamps, confidence, and structured JSONB for object and face detections.

**2. Live Streaming:**
   - **Python OpenCV Service:** Acts as the source for processed frames from RTSP.
   - **`server/src/streams/rtspManager.ts`:** Manages live camera streams. It receives frames from the Python WebSocket client, stores the latest frame, dynamically adjusts streaming FPS based on the number of active viewers, and broadcasts frames to subscribed frontend clients via Socket.io. It also handles client subscriptions/unsubscriptions and monitors stream health.
   - **`go2rtc`:** Integrated as an RTSP proxy/media server. The Node.js backend (`server/src/index.ts`) proxies both HTTP and WebSocket requests for `/go2rtc` to the `go2rtc` instance (default `http://go2rtc:1984`). This indicates `go2rtc` is used for both raw RTSP stream handling and potentially other WebSocket-based media interactions.

**3. Timelapse Generation:**
   - **`server/src/services/timelapse/timelapseService.ts`:** Responsible for generating timelapses. It can stitch together raw samples (captured from live streams) or use detection snapshots to create MP4 videos for specific dates. It also manages file cleanup based on retention policies.
   - **`server/src/utils/cronJobs.ts`:** Scheduled cron jobs automate the nightly stitching of timelapses and the cleanup of old timelapse files.
   - **API Endpoints (`server/src/routes/timelapse.ts`):** Provide functionality for listing, retrieving, and manually triggering the generation of timelapses.

**4. Person Detection:**
   - This is a specific event type handled by the general detection pipeline. The Python OpenCV service identifies "person" objects, and the backend processes and stores these as `person` events in the `events` table, including metadata like `persons_detected` and `faces_detected`.

In summary, the system uses a distributed approach with a Python service for AI/CV, `go2rtc` for RTSP, and a Node.js backend orchestrating detection event persistence, real-time streaming, and timelapse generation, all backed by a PostgreSQL database.
