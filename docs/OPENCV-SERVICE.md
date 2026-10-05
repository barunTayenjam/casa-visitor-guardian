# OpenCV Service

Python Flask + OpenCV + YOLOv8n + InsightFace. The real-time detection engine.

## Quick Start

Model assets are baked into the Docker image (`opencv-service/Dockerfile` runs `download_all_models.py` at build) — no host step needed. To run locally:

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

Tests run in a throwaway container from the opencv image (host has no cv2):
```bash
docker run --rm -v $(pwd)/opencv-service:/app:ro -w /app sentryvision-opencv:latest \
  sh -c "pip install -q pytest pytest-asyncio && python -m pytest tests -q"
```

## Architecture

```
RTSP → FFmpegReader (BGR24 640×360 @5fps)
  → MotionGate (MOG2 background subtraction)
    → InProcessYOLO (model priority via model_selection.py, default YOLOv8n)
      → ByteTracker (two-round IoU association, Kalman filter)
        → IdentityEnrichment (InsightFace ArcFace, 30s cache)
          → HumanVerifier (tiered: YOLO≥0.90 → face → MediaPipe pose → score floor)
              └─ pose_features.py (33 landmarks → stance/facing/arms/torso lean)
            → FramePipeline (snapshot JPEG + bbox aligned to image pixel space)
              → WebSocketPublisher (JSON + JPEG to Node.js :9090)
```

## Pipeline Stages

| Stage | Component | Details |
|-------|-----------|---------|
| Frame capture | `FFmpegReader` | Reads camera streams, outputs BGR24 frames |
| Motion gating | `MotionGate` | MOG2, pixel threshold 500, 10-frame warmup |
| Object detection | `InProcessYOLO` | YOLOv8n ONNX default; `model_selection.py` resolves priority, `YOLO_MODEL` env forces a specific model |
| Tracking | `ByteTracker` | Kalman filter, classic two-round association (strong leftovers re-associated first so lost tracks recover instead of spawning duplicates) |
| Face recognition | `IdentityEnrichment` | InsightFace ArcFace, 30s identity cache |
| Human verification | `HumanVerifier` | Tiered: YOLO ≥ 0.90 → face → MediaPipe pose → score floor (`HUMAN_VERIFIER_SCORE`, default 0.55) |
| Pose semantics | `pose_features.py` | Pure module: 33 MediaPipe landmarks → measured `stance` / `facing` / `arms_raised` / `torso_lean_deg`; reports `unknown` rather than guessing |
| Snapshot + bbox space | `bbox_coords.py` | Event JPEG written from the full-res grab; bboxes published in the snapshot's pixel space (`bboxSpace: 'image'` metadata) |
| Publishing | `WebSocketPublisher` | Frames + events to `ws://localhost:9090` |

## Person Attributes (Measured, Not Guessed)

`person_analyzer.py` prefers MediaPipe measurements over bbox-geometry guesses and
no longer fabricates: no `estimatedAge` (was a distance lookup), no `suspicious`
bodyLanguage (was bbox aspect — it fed threat_detector +20 points on bystanders),
no `side_view_or_crouching` from a wide box, no `back_or_side` facing from a
missed cascade (misses report `unknown`). `threat_detector.py` reads the
`distance` field directly.

## Downstream: Node.js Persistence Gate

Python publishing is not the last word — `server/src/pipeline/detectionPersistence.ts`
drops a person event unless the track has ≥ `PERSON_MIN_TRACK_HITS` (default 3),
score ≥ `PERSON_MIN_CONFIDENCE` (default 0.55) and no explicit rejection.
`trackDeduplicator.ts` collapses repeat person sightings within
`PERSON_DEDUPE_SHIFT_PX` (default 18px) over `PERSON_DEDUPE_WINDOW_MS`
(default 10min). `scripts/backfill-bbox-coordinates.py` converts historical rows
that still carry detect-frame coordinates.

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
| Human verification score floor | 0.55 (`HUMAN_VERIFIER_SCORE`) |

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

Downloaded at image build via `download_all_models.py`:
- YOLOv8n ONNX (~6MB)
- InsightFace ArcFace (~500MB)
- DNN face detection models
- COCO class names

Models stored in `opencv-service/models/` (InsightFace cache is bind-mounted
so rebuilds don't re-download).

## Known Faces

Register faces via DevScreen → FaceRecognizer or API. Stored in:
- `opencv-service/known_faces/` (images)
- PostgreSQL `face_embeddings` (vectors)

## Key Files

| File / Dir | Purpose |
|------------|---------|
| `app.py` | Flask app entry point |
| `rtsp_ingestion/frame_pipeline.py` | Detection loop, snapshot writes, event assembly |
| `rtsp_ingestion/byte_tracker.py` | Two-round multi-object tracking |
| `person_verifier.py` | Tiered human verification |
| `pose_features.py` | Landmarks → measured pose semantics (pure, unit-tested) |
| `person_analyzer.py` | Person attribute analysis (measured-first) |
| `threat_detector.py` | Threat scoring from analysis output |
| `bbox_coords.py` | Detect-frame → snapshot-pixel coordinate alignment |
| `model_selection.py` | YOLO model priority resolution (`YOLO_MODEL` knob) |
| `download_all_models.py` | Model downloader (runs at image build) |
| `tests/` | 136 pytest tests (pure modules + pipeline gates) |
| `requirements.txt` | Python dependencies |
| `models/` | Downloaded model weights |
| `known_faces/` | Registered face images |
| `cameras.json` | Camera config (the copy in opencv-service is the live detection config) |
