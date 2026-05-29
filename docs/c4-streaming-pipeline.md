```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#1a1a2e', 'primaryTextColor': '#e0e0e0', 'primaryBorderColor': '#4a4a6a', 'lineColor': '#6c63ff', 'secondaryColor': '#16213e', 'tertiaryColor': '#0f3460', 'background': '#0d1117', 'mainBkg': '#1a1a2e', 'nodeBorder': '#6c63ff', 'clusterBkg': '#0f3460', 'clusterBorder': '#4a4a6a', 'titleColor': '#e0e0e0', 'edgeLabelBackground': '#1a1a2e', 'fontSize': '13px'}}}%%

C4Component
    title SentryVision Streaming Pipeline — Component Diagram (Level 3)

    %% ─────────────────────────────────────────────────────────────────────
    %% EXTERNAL SYSTEMS
    %% ─────────────────────────────────────────────────────────────────────

    System_Ext(ffmpeg, "FFmpeg CLI", "External process\nRTSP source ingestion\nH.264 → MJPEG/BGR24")

    System_Ext(rtsp_cameras, "IP Cameras", "RTSP/H.264 streams\ntsps://camera.local:554/stream")

    System_Ext(frontend, "React Frontend", "Browser-based client\nSocket.io + REST API")

    System_Ext(postgres_ext, "PostgreSQL", "Events, detections\nface_embeddings table")

    %% ─────────────────────────────────────────────────────────────────────
    %% PYTHON OPENCV SERVICE — INTERNAL COMPONENTS
    %% ─────────────────────────────────────────────────────────────────────

    Boundary(python_svc, "Python OpenCV Service :8084 + :9090", "Docker Container / Process") {

        Component(config, "config.py", "Constants\nResolution, FPS, quality\nYOLO thresholds, model paths")

        Boundary(rtsp_ingestion, "rtsp_ingestion/ Package", "Frame Processing Pipeline") {

            Component(rtsp_svc, "RTSPService\n__init__.py", "Orchestrator\nLoads cameras.json\nManages per-camera\nFramePipeline lifecycle")

            Component(ffmpeg_reader, "FFmpegReader\nffmpeg_reader.py", "Frame Capture (Thread)\nFFmpeg subprocess\nRTSP → raw BGR24\n640×360 @ 5 FPS\nExponential backoff\nreconnect 1s→30s")

            Component(frame_pipeline, "FramePipeline\nframe_pipeline.py", "Per-Camera Chain (Thread)\nOrchestrates pipeline stages\nManages output queues")

            Component(motion_gate, "MotionGate", "Motion Filter\nMOG2 background subtraction\nWarmup: 10 frames\nThreshold: 500 px changed\nFilters static frames")

            Component(in_yolo, "InProcessYOLO", "Object Detector\nYOLOv8n ONNX (OpenCV DNN)\n640×640 blob input\nClass-specific thresholds\nNMS 0.30, min area 1600 px²")

            Component(byte_tracker, "ByteTracker\nbyte_tracker.py", "Multi-Object Tracker\nKalman filter per track\nTwo-round matching (high/low conf)\nTrack lifecycle events:\nstarted/updated/ended")

            Component(identity, "IdentityEnrichment", "Face Recognizer\nFace recognition on new tracks\n30s identity cache\nEmbeds face labels into events")

            Component(live_q, "live_queue\nDropOldestQueue", "JPEG Frame Queue\nmaxsize=2\nLatest frame always available")

            Component(event_q, "event_queue\nDropOldestQueue", "Detection Event Queue\nmaxsize=100\nJSON metadata + snapshots")

        }

        Component(ws_pub, "WebSocketPublisher\nwebsocket_publisher.py", "asyncio WS Server :9090\nSubscribe/unsubscribe per camera\nTwo-part message:\nJSON metadata → Binary JPEG\nMulti-client fan-out\nDead client cleanup")

    }

    %% ─────────────────────────────────────────────────────────────────────
    %% EXPRESS BACKEND — INTERNAL COMPONENTS
    %% ─────────────────────────────────────────────────────────────────────

    Boundary(express_backend, "Express Backend :9753", "Node.js / TypeScript") {

        Boundary(streaming_core, "Streaming Core", "Real-time frame relay") {

            Component(stream_mgr, "StreamManager\nrtspManager.ts", "Core Orchestrator\nSocket.io frame relay via PythonWsClient\nStores lastFrame per camera\nAdaptive FPS throttling\nViewer tracking (socket ID sets)\n5-min inactivity timeout")

            Component(py_ws, "PythonWsClient\npythonWsClient.ts", "WebSocket Client\nws://localhost:9090\nSubscribe/unsubscribe cameras\nBinary JPEG + JSON events\nRe-emits as Node EventEmitter\nAuto-reconnect 1s→30s")

            Component(sio_server, "Socket.io Server\n(index.ts)", "Real-time Relay\nrequestStream / stopStream\nBridges trackingEvent → rooms\nEmits: detection, motionDetected\npersonDetected, faceDetected")

        }

        Boundary(rest_api, "REST API Layer", "HTTP Endpoints") {

            Component(stream_ctrl, "StreamController", "REST Endpoints\nGET /api/streams/:id/live (MJPEG)\nGET /api/streams/:id/frame (JPEG)\nGET /api/streams/:id/status\nGET /api/streaming/metrics")

        }

        Component(health_mon, "StreamHealthMonitor\nstreamHealthMonitor.ts", "Health Watchdog\n30s check cycle\nStale: no frames for 5 min\nAuto-restart: max 3/hr/camera\nSeverity: info/warning/critical")

    }

    %% ─────────────────────────────────────────────────────────────────────
    %% RELATIONSHIPS — EXTERNAL TO CONTAINERS
    %% ─────────────────────────────────────────────────────────────────────

    Rel(rtsp_cameras, ffmpeg, "RTSP/H.264\ntsps://:554/stream", "TCP")
    Rel(frontend, sio_server, "Socket.io\nrequestStream, stopStream\nReceives: frame, detection", "WebSocket")
    Rel(frontend, stream_ctrl, "REST API\nMJPEG stream, snapshots\nstatus, metrics", "HTTP")

    %% ─────────────────────────────────────────────────────────────────────
    %% RELATIONSHIPS — PYTHON INTERNAL
    %% ─────────────────────────────────────────────────────────────────────

    Rel(rtsp_svc, config, "Read thresholds\nFPS, resolution, quality")
    Rel(rtsp_svc, ffmpeg_reader, "Create per-camera\nFFmpegReader instances", "Thread spawn")
    Rel(ffmpeg_reader, ffmpeg, "FFmpeg subprocess\n-hwaccel auto -rtsp_transport tcp\n-s 640x360 -r 5\n-f rawvideo pix_fmt=bgr24", "stdout pipe")
    Rel(ffmpeg_reader, frame_pipeline, "Raw BGR24 frame\nnumpy array 640×360×3", "Thread queue")
    Rel(frame_pipeline, motion_gate, "Every frame\nBGR numpy array")
    Rel(motion_gate, in_yolo, "Frame with motion\n(motion pixels ≥ 500)", "Conditional")
    Rel(in_yolo, byte_tracker, "YOLO detections\n[class, conf, bbox]", "Detections array")
    Rel(byte_tracker, identity, "Tracked objects\nwith track IDs", "Track updates")
    Rel(frame_pipeline, live_q, "JPEG-encoded frame\n(cv2.imencode)", "Enqueue")
    Rel(identity, event_q, "Enriched events\nJSON + optional snapshot", "Enqueue")
    Rel(live_q, ws_pub, "Dequeue JPEG frame", "asyncio")
    Rel(event_q, ws_pub, "Dequeue event JSON\n+ binary snapshot", "asyncio")

    %% ─────────────────────────────────────────────────────────────────────
    %% RELATIONSHIPS — BACKEND INTERNAL
    %% ─────────────────────────────────────────────────────────────────────


    Rel(py_ws, sio_server, "Room: forward trackingEvent\n→ Socket.io emit detection, personDetected, motionDetected", "EventEmitter")
    Rel(sio_server, stream_mgr, "requestStream / stopStream\nviewer tracking", "Socket.io events")
    Rel(stream_ctrl, stream_mgr, "Read .lastFrame\nfor JPEG snapshot\nRead viewer counts", "Direct access")
    Rel(health_mon, stream_mgr, "Health probes\nstale detection\nrestart triggers", "30s polling")

    %% ─────────────────────────────────────────────────────────────────────
    %% RELATIONSHIPS — CROSS-CONTAINER (Backend ↔ Python)
    %% ─────────────────────────────────────────────────────────────────────

    Rel(py_ws, ws_pub, "WebSocket\nws://localhost:9090\nsubscribe/unsubscribe\nrecv: binary JPEG + JSON", "WebSocket")


    %% ─────────────────────────────────────────────────────────────────────
    %% LAYOUT HINTS
    %% ─────────────────────────────────────────────────────────────────────

    %% Layout: External systems at top, containers in middle, databases at bottom
    %% Python container on the left, Express container on the right

    LAYOUT_WITH_LEGEND()
```
