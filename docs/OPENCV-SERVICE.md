# OpenCV Service

Python Flask + OpenCV + YOLOv8n + InsightFace. The real-time detection engine.

## Quick Start

```bash
cd opencv-service
python3 download_all_models.py
pip install -r requirements.txt
python3 -m flask --app app run --host 0.0.0.0 --port 8084
```

Docker (hot-mounted, no rebuild needed):
```bash
docker restart sentryvision-opencv
```

## Architecture

```
RTSP → FFmpegReader (BGR24 640×360 @5fps)
  → MotionGate (MOG2 background subtraction)
    → InProcessYOLO (YOLOv8n → YOLOv5n → yolov4-tiny fallback)
      → ByteTracker (multi-object tracking, Kalman filter)
        → IdentityEnrichment (InsightFace ArcFace, 30s cache)
          → HumanVerifier (tiered: YOLO≥0.90 → face → MediaPipe pose → score floor)
            → WebSocketPublisher (JSON + JPEG to Node.js :9090)
```

## Pipeline Stages

| Stage | Component | Details |
|-------|-----------|---------|
| Frame capture | `FFmpegReader` | Reads camera streams, outputs BGR24 frames |
| Motion gating | `MotionGate` | MOG2, pixel threshold 500, 10-frame warmup |
| Object detection | `InProcessYOLO` | YOLOv8n ONNX, 215ms inference, class whitelist |
| Tracking | `ByteTracker` | Kalman filter, lifecycle: started/updated/ended |
| Face recognition | `IdentityEnrichment` | InsightFace ArcFace, 30s identity cache |
| Human verification | `HumanVerifier` | Tiered pipeline (YOLO → face → pose → floor 0.55) |
| Publishing | `WebSocketPublisher` | Frames + events to `ws://localhost:9090` |

## Detection Classes

Whitelisted COCO classes to reduce false positives:
- `person`, `car`, `truck`, `bus`, `motorcycle`, `bicycle`
- `dog`, `cat`, `bird`, `horse`

Blocked false positives: `train`, `surfboard`, `vase`, `potted plant`

## Confidence Thresholds

| Class | Threshold |
|-------|-----------|
| person | 0.30 |
| car | 0.35 |
| default | 0.50 |
| Human verification floor | 0.55 (day) / 0.55 (night) |

## go2rtc Integration

**Critical:** TP-LINK cameras allow only 1 concurrent RTSP connection.

- go2rtc holds the sole connection
- Python reads from `rtsp://go2rtc:8554/{camera_id}`
- Never connect FFmpeg directly to cameras

## Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 8084 | HTTP/Flask | REST API (`/health`, `/detect-*`) |
| 9090 | WebSocket | Frame + event publishing to Node.js |

## Health Check

```bash
curl http://localhost:8084/health
```

## Models

Downloaded once via `python3 download_all_models.py`:
- YOLOv8n ONNX (~6MB)
- InsightFace ArcFace (~500MB)
- DNN face detection models
- COCO class names

Models stored in `opencv-service/models/`.

## Known Faces

Register faces via DevScreen → FaceRecognizer or API. Stored in:
- `opencv-service/known_faces/` (images)
- PostgreSQL `face_embeddings` (vectors)

## Key Files

| File / Dir | Purpose |
|------------|---------|
| `app.py` | Flask app entry point |
| `rtsp_ingestion/` | FFmpeg reader + WebSocket publisher |
| `person_verifier.py` | Human verification pipeline |
| `person_analyzer.py` | Person attribute analysis |
| `download_all_models.py` | One-time model downloader |
| `requirements.txt` | Python dependencies |
| `models/` | Downloaded model weights |
| `known_faces/` | Registered face images |
| `cameras.json` | Camera config (mounted from host) |
