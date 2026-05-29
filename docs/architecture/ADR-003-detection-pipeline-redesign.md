# ADR-003 (Revised): Pragmatic Edge Detection Pipeline

**Status**: Accepted

> **Accepted 2026-05-29** — Phase 5 (Pipeline Cleanup) complete. All legacy Node.js detection modules removed. `PIPELINE_MODE` defaults to `python-only`. FFmpeg subprocess management stripped from rtspManager; Python pipeline owns RTSP ingestion and frame delivery via WebSocket.
**Date**: 2026-05-28
**Version**: 4.0

---

# Context

The current detection system evolved incrementally and now suffers from architectural inefficiencies:

1. Redundant JPEG encode/decode pipeline between Node.js and Python.
2. Duplicate detection events due to lack of temporal tracking.
3. Fixed-interval HTTP polling introduces latency and unnecessary IPC overhead.
4. `face_recognition` accuracy degrades in low-light CCTV conditions.
5. RTSP ownership split across Node.js and Python creates synchronization and operational complexity.
6. No explicit realtime backpressure or frame-dropping strategy.
7. Insufficient observability for production debugging.

The goal of this ADR is to:

* eliminate unnecessary CPU waste,
* improve event quality,
* simplify architecture,
* preserve current frontend APIs,
* avoid premature distributed-system complexity,
* remain operationally lightweight.

This ADR intentionally avoids:

* Kafka,
* Redis Streams,
* microservice decomposition,
* Triton,
* Kubernetes-level orchestration.

The target deployment is:

* edge/home security deployments,
* ≤10 cameras,
* 720p detection streams,
* optional GPU acceleration.

---

# Architectural Principles

## 1. Python Owns Pixels

The service consuming pixels should own RTSP ingestion.

Node.js should not:

* decode video,
* manage frame timing,
* orchestrate inference.

Python owns:

* ingestion,
* motion gating,
* inference,
* tracking,
* recognition.

Node.js owns:

* persistence,
* notifications,
* frontend communication,
* orchestration/UI.

---

## 2. Temporal Intelligence Over Frame Intelligence

The system should emit:

* object lifecycle events,
  not:
* per-frame detections.

Tracking becomes the primary event unit.

---

## 3. Realtime Systems Prefer Frame Dropping Over Latency

Under overload:

* stale frames are worthless,
* queues must remain bounded,
* newest data wins.

The system must aggressively drop frames instead of accumulating latency.

---

# Current Architecture

```text
RTSP Camera
   ↓
Node.js FFmpeg
   ↓ JPEG encode
HTTP POST
   ↓ JPEG decode
Python Flask
   ↓
YOLO + face_recognition
   ↓
Node.js persistence/events
```

Problems:

* duplicated decoding,
* HTTP overhead,
* duplicated buffering,
* no tracking,
* poor scaling behavior.

---

# Proposed Architecture

```text
RTSP Camera
   ↓
FFmpeg Pipe / PyAV
   ↓ raw frames (numpy)
Python CV Service
   ├── Motion Gate (MOG2)
   ├── YOLOv8n (ONNX Runtime)
   ├── ByteTrack
   ├── InsightFace ArcFace
   └── WebSocket Publisher
           ↓
Node.js Gateway
   ├── PostgreSQL
   ├── Socket.io
   └── Frontend
```

---

# Key Architectural Changes

| Change                       | Why                                 |
| ---------------------------- | ----------------------------------- |
| Python owns RTSP             | Removes JPEG encode/decode waste    |
| FFmpeg/PyAV ingestion        | More stable than `cv2.VideoCapture` |
| WebSocket instead of polling | Lower latency, lower overhead       |
| ByteTrack                    | Eliminates duplicate alerts         |
| InsightFace ArcFace          | Better low-light recognition        |
| Bounded queues               | Prevents latency explosion          |
| Temporal events              | Improves UX dramatically            |

---

# RTSP Ingestion Strategy

## Decision

Do NOT use:

```python
cv2.VideoCapture(rtsp_url)
```

Instead use:

* FFmpeg subprocess pipes,
  or
* PyAV.

---

## Rationale

OpenCV RTSP handling becomes unstable under:

* reconnects,
* jitter,
* packet loss,
* multi-camera workloads.

FFmpeg provides:

* mature RTSP handling,
* reconnect support,
* transport tuning,
* hardware decode support,
* predictable buffering behavior.

---

# Pipeline Design

```text
RTSP
  ↓
FFmpeg decode
  ↓
Frame Buffer
  ↓
Motion Gate (MOG2)
  ↓ motion frames only
YOLOv8n + ByteTrack
  ↓ tracked entities
Face Recognition (new tracks only)
  ↓
Event Aggregator
  ↓
WebSocket Publisher
```

---

# Threading Model

## Per Camera

| Component       | Execution Model         |
| --------------- | ----------------------- |
| RTSP reader     | dedicated subprocess    |
| Frame ingestion | dedicated thread        |
| Motion gating   | worker thread           |
| Detection       | shared inference worker |
| WebSocket       | asyncio loop            |

---

# Queue Policies (MANDATORY)

## Design Principle

Realtime systems must:

* bound memory,
* prefer freshness,
* drop old frames aggressively.

---

## Queue Definitions

### Live Frame Queue

```python
maxsize = 2
policy = drop_oldest
```

Purpose:

* live preview only,
* freshness prioritized over completeness.

---

### Motion Queue

```python
maxsize = 5
policy = drop_if_full
```

Purpose:

* prevent motion storms from overwhelming detection.

---

### Detection Queue

```python
maxsize = 10
policy = drop_oldest
```

Purpose:

* keep inference near realtime.

---

# Motion Detection Strategy

## Role of MOG2

MOG2 is NOT authoritative detection.

It is:

* a lightweight motion gate,
* designed only to reduce YOLO workload.

---

## Important Constraint

Final event generation depends on:

* YOLO detections,
* NOT raw motion triggers.

This avoids:

* rain alerts,
* lighting flicker alerts,
* IR noise alerts.

---

# Object Detection

## Model

* YOLOv8n
* ONNX Runtime

---

## Execution Providers

Preferred order:

```text
CUDAExecutionProvider
CPUExecutionProvider
```

Fallback to CPU must always work.

---

## Detection Rate

Detection rate is decoupled from stream FPS.

Example:

| Stream FPS | Detection FPS |
| ---------- | ------------- |
| 20 FPS     | 4 FPS         |

Controlled via:

```python
frame_skip
```

---

# Tracking Strategy

## ByteTrack

ByteTrack becomes the authoritative entity layer.

Events are emitted only when:

* a new track appears,
* track state changes,
* confidence meaningfully changes,
* track exits.

---

## Event Example

```json
{
  "event": "track_started",
  "track_id": 42,
  "label": "person",
  "camera_id": "front-door"
}
```

---

# Face Recognition

## Model

Replace:

* `face_recognition`

With:

* InsightFace ArcFace

---

## Recognition Policy

Face recognition only occurs:

* on NEW tracks,
* or periodic revalidation.

Never:

* every frame.

---

## Identity Cache

```text
track_id → identity
TTL = 30s
```

This prevents repeated recognition work.

---

# WebSocket Protocol

## Simplification Decision

Avoid custom binary framing protocol.

Use:

* JSON metadata,
* binary JPEG payload separately.

Protocol simplicity is prioritized over micro-optimization.

---

# WebSocket Failure Semantics

## Node.js Disconnect

If Node.js disconnects:

* detection continues,
* bounded event queues buffer temporarily,
* oldest events drop first.

---

## Recovery

On reconnect:

* Node.js re-subscribes,
* live streaming resumes automatically.

No replay guarantees are provided.

This is a realtime system, not an event-sourcing system.

---

# Observability Requirements

The following metrics are mandatory:

| Metric                   | Purpose                 |
| ------------------------ | ----------------------- |
| RTSP reconnect count     | camera stability        |
| per-camera FPS           | ingestion health        |
| dropped frame count      | overload detection      |
| queue depth              | backpressure visibility |
| YOLO latency             | inference performance   |
| face recognition latency | identity cost           |
| websocket latency        | IPC health              |
| active tracks            | tracking behavior       |

---

# Node.js Responsibilities

Node.js becomes:

* lightweight gateway/orchestrator.

Responsibilities:

* PostgreSQL writes,
* Socket.io broadcasting,
* alerting,
* frontend state,
* camera management.

Node.js no longer:

* decodes streams,
* owns FFmpeg,
* performs motion logic.

---

# Frontend Compatibility

Socket.io contracts remain unchanged.

No changes required for:

* React frontend,
* stream panels,
* detection event consumers.

This minimizes migration risk.

---

# Migration Plan

## Phase 1 — RTSP Ownership Transfer

* Add FFmpeg/PyAV ingestion in Python.
* Add WebSocket publisher.
* Dual-run existing Node.js FFmpeg pipeline.
* Preserve HTTP endpoints.

Success criteria:

* identical live stream quality,
* lower CPU usage.

Duration:
~1 week.

---

## Phase 2 — Tracking Integration

* Add YOLOv8n ONNX Runtime.
* Add ByteTrack.
* Add bounded queues.
* Add frame dropping policies.

Success criteria:

* duplicate alerts reduced by >80%.

Duration:
~1 week.

---

## Phase 3 — Face Recognition Upgrade

* Add InsightFace ArcFace.
* Re-enroll identities.
* Add identity cache.

Success criteria:

* improved low-light recognition accuracy.

Duration:
~3 days.

---

## Phase 4 — Cleanup

Remove:

* Node.js FFmpeg ownership,
* polling detection,
* HTTP retry logic,
* duplicate motion systems,
* `face_recognition`.

Duration:
~1 day.

---

# Explicit Non-Goals

This ADR intentionally does NOT include:

* Kafka,
* Redis Streams,
* microservice decomposition,
* distributed queues,
* GPU orchestration,
* Triton inference server,
* horizontal scaling.

These become relevant only if:

* deployment exceeds ~10 cameras,
* multi-node scaling is required,
* GPU sharing becomes necessary.

---

# Decision

Proceed with phased migration.

This architecture:

* fixes the real bottlenecks,
* preserves operational simplicity,
* improves realtime behavior,
* dramatically improves event quality,
* minimizes infrastructure complexity,
* remains maintainable for edge deployments.

This is an edge inference appliance architecture,
not a distributed computer vision platform.
