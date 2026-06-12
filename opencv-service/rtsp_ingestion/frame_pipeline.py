#!/usr/bin/env python3
"""
Per-camera frame processing pipeline.

    FFmpegReader (HD 1280x720)
          │
          ├─→ JPEG encode → live_queue → WebSocket (always, zero-delay)
          │
          └─→ cv2.resize(640x360) → detection_queue
                                             │
                                       DetectionThread:
                                             │
                                       MotionGate (MOG2)
                                             │  motion
                                             ▼
                                       YOLO Detection (in-process cv2.dnn)
                                             ▼
                                       ByteTrack Tracking
                                             ▼
                                       Face Recognition (new tracks, identity cache TTL=30s)
                                             ▼
                                       WebSocket Publisher (frames + track-lifecycle events)

Live streaming is fully decoupled from detection — YOLO inference (1-4s on CPU)
never blocks the live frame path, eliminating stream latency.
"""

import time
import queue
import cv2
import numpy as np
import os
import hashlib
import threading
from typing import Optional, Dict, Any, List

from .config import (
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    DEFAULT_FPS,
    DETECTION_FPS,
    DETECT_WIDTH,
    DETECT_HEIGHT,
    LIVE_WIDTH,
    LIVE_HEIGHT,
    MOG2_HISTORY,
    MOG2_VAR_THRESHOLD,
    MOTION_PIXEL_THRESHOLD,
    JPEG_QUALITY,
    INFERENCE_BACKEND,
    INFERENCE_TARGET,
)
from .queues import DropOldestQueue, DropIfFullQueue
from .ffmpeg_reader import FFmpegReader
from .websocket_publisher import WebSocketPublisher
from .byte_tracker import ByteTracker


class MotionGate:
    """Per-camera MOG2 background subtractor for motion gating."""

    def __init__(
        self,
        camera_id: str,
        history: int = MOG2_HISTORY,
        var_threshold: int = MOG2_VAR_THRESHOLD,
        pixel_threshold: int = MOTION_PIXEL_THRESHOLD,
    ):
        self.camera_id = camera_id
        self._bg_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=history,
            varThreshold=var_threshold,
            detectShadows=False,
        )
        self._pixel_threshold = pixel_threshold
        self._frame_count = 0
        self._warmup_frames = 10

    def detect(self, frame: np.ndarray) -> dict:
        self._frame_count += 1
        fg_mask = self._bg_subtractor.apply(frame)
        _, fg_mask = cv2.threshold(fg_mask, 250, 255, cv2.THRESH_BINARY)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel, iterations=1)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel, iterations=1)
        motion_pixels = cv2.countNonZero(fg_mask)
        total_pixels = fg_mask.shape[0] * fg_mask.shape[1]
        motion_percentage = (motion_pixels / total_pixels) * 100
        if self._frame_count < self._warmup_frames:
            return {"motion_detected": False, "motion_pixels": motion_pixels, "confidence": 0.0}
        motion_detected = motion_pixels > self._pixel_threshold
        confidence = min(100.0, motion_percentage * 10)
        return {"motion_detected": motion_detected, "motion_pixels": motion_pixels, "confidence": round(confidence, 2)}


class InProcessYOLO:
    """YOLO object detector running in-process via cv2.dnn.

    Loads YOLOv8n.onnx > YOLOv5n.onnx > yolov4-tiny.
    Avoids the HTTP self-call overhead of the previous architecture.
    """

    _COCO_CLASSES: Optional[List[str]] = None

    def __init__(self, models_dir: str):
        self._models_dir = models_dir
        self._net = None
        self._model_type = None
        self._input_size = 640
        self._confidence_threshold = 0.30
        self._nms_threshold = 0.45
        self._class_thresholds = {
            "person": 0.45, "car": 0.50, "truck": 0.70, "bus": 0.50,
            "motorcycle": 0.50, "bicycle": 0.50, "dog": 0.50, "cat": 0.50,
        }
        self._default_threshold = 0.60
        self._min_box_area = 2500
        self._min_box_side = 50
        self._initialized = False
        self._class_names = self._load_class_names()
        self._backend_label = 'CPU'
        self._last_inference_ms = 0.0
        self._inference_count = 0
        self._total_inference_ms = 0.0

    def _load_class_names(self) -> List[str]:
        for name in ("yolo_classes.txt", "coco.names"):
            p = os.path.join(self._models_dir, name)
            if os.path.exists(p):
                with open(p, "r") as f:
                    return [l.strip() for l in f if l.strip()]
        return ["person", "bicycle", "car", "motorcycle", "airplane", "bus",
                "train", "truck", "boat"]

    def _detect_backend(self) -> tuple:
        if INFERENCE_BACKEND == 'cpu':
            return (cv2.dnn.DNN_BACKEND_OPENCV, cv2.dnn.DNN_TARGET_CPU, 'CPU')
        try:
            device_count = cv2.cuda.getCudaEnabledDeviceCount()
            if device_count > 0:
                return (cv2.dnn.DNN_BACKEND_CUDA, cv2.dnn.DNN_TARGET_CUDA, 'CUDA')
        except (AttributeError, cv2.error):
            pass
        return (cv2.dnn.DNN_BACKEND_OPENCV, cv2.dnn.DNN_TARGET_CPU, 'CPU')

    def initialize(self) -> bool:
        if self._initialized:
            return True
        for filename, mtype in [("yolov8n.onnx", "yolov8"), ("yolov5n.onnx", "yolov5")]:
            path = os.path.join(self._models_dir, filename)
            if os.path.exists(path):
                self._net = cv2.dnn.readNet(path)
                backend, target, label = self._detect_backend()
                self._net.setPreferableBackend(backend)
                self._net.setPreferableTarget(target)
                self._backend_label = label
                self._model_type = mtype
                self._initialized = True
                print(f"[InProcessYOLO] {mtype} initialized with {label} backend")
                return True
        weights = os.path.join(self._models_dir, "yolov4-tiny.weights")
        cfg = os.path.join(self._models_dir, "yolov4-tiny.cfg")
        if os.path.exists(weights) and os.path.exists(cfg):
            self._net = cv2.dnn.readNet(weights, cfg)
            self._model_type = "yolov4"
            try:
                self._net.setPreferableBackend(cv2.dnn.DNN_BACKEND_CUDA)
                self._net.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA)
                self._backend_label = 'CUDA'
            except Exception:
                self._net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                self._net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                self._backend_label = 'CPU'
            self._initialized = True
            print(f"[InProcessYOLO] yolov4 initialized with {self._backend_label} backend")
            return True
        return False

    _inference_lock = __import__("threading").Lock()

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        if not self._initialized or self._net is None:
            return []
        
        with self._inference_lock:
            h, w = frame.shape[:2]
            blob = cv2.dnn.blobFromImage(frame, 1 / 255.0, (self._input_size, self._input_size), swapRB=True, crop=False)
            self._net.setInput(blob)
            t_start = time.perf_counter()
            try:
                outputs = self._net.forward(self._net.getUnconnectedOutLayersNames()) if self._model_type == "yolov4" else [self._net.forward()]
            except cv2.error:
                self._net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                self._net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                outputs = self._net.forward(self._net.getUnconnectedOutLayersNames()) if self._model_type == "yolov4" else [self._net.forward()]
        
        elapsed_ms = (time.perf_counter() - t_start) * 1000
        self._last_inference_ms = elapsed_ms
        self._inference_count += 1
        self._total_inference_ms += elapsed_ms
        if self._inference_count % 100 == 0:
            avg = self._total_inference_ms / self._inference_count
            print(f"[InProcessYOLO] inference={elapsed_ms:.1f}ms backend={self._backend_label} model={self._model_type} avg={avg:.1f}ms")

        boxes, confidences, class_ids = [], [], []
        if self._model_type in ("yolov8", "yolov5"):
            output = outputs[0]
            if output.shape[0] not in (1, output.shape[0]):
                pass
            if len(output.shape) == 3 and output.shape[0] == 1:
                output = output[0]
            num_classes = output.shape[-1] - (4 if self._model_type == "yolov8" else 5)
            for det in output:
                if self._model_type == "yolov8":
                    scores = det[4:]
                else:
                    obj_conf = det[4]
                    scores = det[5:] * obj_conf
                cid = int(np.argmax(scores))
                conf = float(scores[cid])
                cname = self._class_names[cid] if cid < len(self._class_names) else f"obj_{cid}"
                thresh = self._class_thresholds.get(cname, self._default_threshold)
                if conf < thresh:
                    continue
                cx, cy, bw, bh = det[0], det[1], det[2], det[3]
                if self._model_type == "yolov5":
                    sx, sy = w / self._input_size, h / self._input_size
                    x = int((cx - bw / 2) * sx)
                    y = int((cy - bh / 2) * sy)
                    bw = int(bw * sx)
                    bh = int(bh * sy)
                else:
                    x = int((cx - bw / 2) * w)
                    y = int((cy - bh / 2) * h)
                    bw = int(bw * w)
                    bh = int(bh * h)
                x, y = max(0, x), max(0, y)
                bw, bh = min(w - x, bw), min(h - y, bh)
                if bw >= self._min_box_side and bh >= self._min_box_side and bw * bh >= self._min_box_area:
                    boxes.append([x, y, bw, bh])
                    confidences.append(float(conf))
                    class_ids.append(cid)
        else:
            for out in outputs:
                for det in out:
                    obj_conf = float(det[4])
                    scores = det[5:]
                    cid = int(np.argmax(scores))
                    conf = float(scores[cid]) * obj_conf
                    cname = self._class_names[cid] if cid < len(self._class_names) else f"obj_{cid}"
                    thresh = self._class_thresholds.get(cname, self._default_threshold)
                    if conf < thresh:
                        continue
                    cx = int(det[0] * w)
                    cy = int(det[1] * h)
                    bw = int(det[2] * w)
                    bh = int(det[3] * h)
                    x = cx - bw // 2
                    y = cy - bh // 2
                    x, y = max(0, x), max(0, y)
                    bw, bh = min(w - x, bw), min(h - y, bh)
                    if bw >= self._min_box_side and bh >= self._min_box_side and bw * bh >= self._min_box_area:
                        boxes.append([x, y, bw, bh])
                        confidences.append(float(conf))
                        class_ids.append(cid)

        indices = cv2.dnn.NMSBoxes(boxes, confidences, self._confidence_threshold, self._nms_threshold)
        results = []
        if len(indices) > 0:
            for i in indices.flatten():
                cname = self._class_names[class_ids[i]] if class_ids[i] < len(self._class_names) else f"obj_{class_ids[i]}"
                results.append({
                    "bbox": [boxes[i][0], boxes[i][1], boxes[i][2], boxes[i][3]],
                    "score": round(confidences[i], 4),
                    "class": cname,
                    "class_id": class_ids[i],
                })
        return results

    def get_metrics(self) -> dict:
        return {
            'backend': self._backend_label,
            'model_type': self._model_type,
            'last_inference_ms': round(self._last_inference_ms, 1),
            'inference_count': self._inference_count,
            'avg_inference_ms': round(self._total_inference_ms / max(1, self._inference_count), 1),
        }


class IdentityCache:
    """TTL-based cache mapping track_id → identity.

    Prevents repeated face-recognition work on already-identified tracks.
    TTL = 30 seconds per ADR-003.
    """

    def __init__(self, ttl: float = 30.0):
        self._ttl = ttl
        self._store: Dict[int, tuple] = {}

    def get(self, track_id: int) -> Optional[Dict[str, Any]]:
        entry = self._store.get(track_id)
        if entry is None:
            return None
        identity, ts = entry
        if time.time() - ts > self._ttl:
            del self._store[track_id]
            return None
        return identity

    def put(self, track_id: int, identity: Dict[str, Any]) -> None:
        self._store[track_id] = (identity, time.time())

    def invalidate(self, track_id: int) -> None:
        self._store.pop(track_id, None)

    def cleanup(self) -> None:
        now = time.time()
        expired = [k for k, (_, ts) in self._store.items() if now - ts > self._ttl]
        for k in expired:
            del self._store[k]


class FramePipeline:
    """Per-camera pipeline with decoupled live streaming and detection.

    Architecture:
        FFmpegReader (HD 1280x720)
              │
              ├─→ JPEG encode → live_queue → WebSocket (always, zero-delay)
              │
              └─→ cv2.resize(640x360) → detection_queue
                                                 │
                                           DetectionThread:
                                                 │
                                           MotionGate (MOG2)
                                                 │  motion
                                                 ▼
                                           YOLO Detection
                                                 ▼
                                           ByteTrack
                                                 ▼
                                           Face Recognition
                                                 ▼
                                           event_queue → WebSocket
    """

    _yolo_detector: Optional[InProcessYOLO] = None
    _yolo_init_lock = __import__("threading").Lock()

    def __init__(
        self,
        camera_config: dict,
        publisher: WebSocketPublisher,
        frame_skip: int = 1,
    ):
        self._config = camera_config
        self._publisher = publisher
        self._frame_skip = frame_skip
        self._frame_counter = 0
        self._camera_id: str = camera_config["id"]

        self._live_queue: DropOldestQueue = publisher.add_frame_queue(self._camera_id)
        self._event_queue: DropOldestQueue = publisher.add_event_queue(self._camera_id)
        self._detection_queue: queue.Queue = queue.Queue(maxsize=2)

        self._motion_gate = MotionGate(camera_id=self._camera_id, pixel_threshold=MOTION_PIXEL_THRESHOLD)
        self._tracker = ByteTracker(track_thresh=0.25, match_thresh=0.8, track_buffer=30, frame_rate=DETECTION_FPS)
        self._identity_cache = IdentityCache(ttl=30.0)
        self._face_recognition_fn = None

        live_cfg = self._config.get("live", {})
        self._live_width = live_cfg.get("width", LIVE_WIDTH)
        self._live_height = live_cfg.get("height", LIVE_HEIGHT)

        detect_cfg = self._config.get("detect", {})
        self._detect_width = detect_cfg.get("width", DETECT_WIDTH)
        self._detect_height = detect_cfg.get("height", DETECT_HEIGHT)

        live_stream = self._get_stream_by_role("live")
        detect_stream = self._get_stream_by_role("detect")

        self._live_reader: Optional[FFmpegReader] = None
        self._detect_reader: Optional[FFmpegReader] = None

        if live_stream and detect_stream and live_stream["path"] != detect_stream["path"]:
            self._live_reader = FFmpegReader(
                rtsp_url=live_stream["path"],
                camera_id=f"{self._camera_id}-live",
                width=self._live_width,
                height=self._live_height,
                fps=live_cfg.get("fps", DEFAULT_FPS),
                scale=False,
            )
            self._detect_reader = FFmpegReader(
                rtsp_url=detect_stream["path"],
                camera_id=f"{self._camera_id}-detect",
                width=self._detect_width,
                height=self._detect_height,
                fps=detect_cfg.get("fps", DEFAULT_FPS),
                scale=False,
            )
        else:
            fallback = live_stream or detect_stream or self._get_primary_stream()
            self._live_reader = FFmpegReader(
                rtsp_url=fallback["path"],
                camera_id=self._camera_id,
                width=self._live_width,
                height=self._live_height,
                fps=live_cfg.get("fps", DEFAULT_FPS),
                scale=False,
            )

        self._detection_thread: Optional[threading.Thread] = None
        self._running = False

        self._init_yolo()

    @classmethod
    def _init_yolo(cls):
        with cls._yolo_init_lock:
            if cls._yolo_detector is not None:
                return
            models_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
            detector = InProcessYOLO(models_dir)
            ok = detector.initialize()
            if ok:
                cls._yolo_detector = detector
                print("[FramePipeline] In-process YOLO detector initialized")
            else:
                print("[FramePipeline] WARNING: No YOLO model could be loaded")

    def set_face_recognition(self, fn):
        self._face_recognition_fn = fn

    def _get_primary_stream(self) -> dict:
        streams = self._config.get("streams", [])
        for s in streams:
            if "detect" in s.get("roles", []):
                return s
        for s in streams:
            if "live" in s.get("roles", []):
                return s
        return streams[0] if streams else {}

    def _get_stream_by_role(self, role: str) -> Optional[dict]:
        streams = self._config.get("streams", [])
        for s in streams:
            if role in s.get("roles", []):
                return s
        return None

    @property
    def camera_id(self) -> str:
        return self._camera_id

    def start(self) -> None:
        self._running = True
        self._detection_thread = threading.Thread(
            target=self._detection_loop,
            name=f"detect-{self._camera_id}",
            daemon=True,
        )
        self._detection_thread.start()
        if self._detect_reader:
            self._detect_reader.start(self._on_detect_frame)
        else:
            self._live_reader.start(self._on_live_frame)
        mode = "dual" if self._detect_reader else "single"
        print(f"[FramePipeline:{self._camera_id}] Started ({mode}, detect-only, live=on-demand)")

    def start_live(self) -> None:
        if self._live_reader and not self._live_reader.running:
            self._live_reader.start(self._on_live_frame)
            print(f"[FramePipeline:{self._camera_id}] Live reader started (on-demand)")

    def stop_live(self) -> None:
        if self._live_reader and self._live_reader.running:
            self._live_reader.stop()
            print(f"[FramePipeline:{self._camera_id}] Live reader stopped (no viewers)")

    def stop(self) -> None:
        self._running = False
        self._live_reader.stop()
        if self._detect_reader:
            self._detect_reader.stop()
        if self._detection_thread:
            self._detection_thread.join(timeout=5)
        print(f"[FramePipeline:{self._camera_id}] Stopped")

    def _on_live_frame(self, frame_data: dict) -> None:
        self._frame_counter += 1
        frame: np.ndarray = frame_data["data"]

        if self._frame_counter % self._frame_skip == 0:
            success, jpeg_buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
            if success:
                self._live_queue.put(jpeg_buf.tobytes())

        if not self._detect_reader:
            small = cv2.resize(frame, (self._detect_width, self._detect_height), interpolation=cv2.INTER_AREA)
            try:
                self._detection_queue.put_nowait(small)
            except queue.Full:
                pass

    def _on_detect_frame(self, frame_data: dict) -> None:
        frame: np.ndarray = frame_data["data"]
        try:
            self._detection_queue.put_nowait(frame)
        except queue.Full:
            pass

    def _detection_loop(self) -> None:
        print(f"[FramePipeline:{self._camera_id}] Detection thread started")
        frame_count = 0
        while self._running:
            try:
                frame = self._detection_queue.get(timeout=1.0)
            except queue.Empty:
                continue

            frame_count += 1
            if frame_count <= 5 or frame_count % 100 == 0:
                print(f"[FramePipeline:{self._camera_id}] Detection frame #{frame_count}, queue={self._detection_queue.qsize()}")

            try:
                self._process_detection(frame)
            except Exception as e:
                print(f"[FramePipeline:{self._camera_id}] Detection error: {e}")
                import traceback
                traceback.print_exc()

    def _process_detection(self, frame: np.ndarray) -> None:
        motion_result = self._motion_gate.detect(frame)
        self._detect_frame_count = getattr(self, '_detect_frame_count', 0) + 1
        if self._detect_frame_count <= 10 or self._detect_frame_count % 100 == 0:
            print(f"[FramePipeline:{self._camera_id}] MOG2 check #{self._detect_frame_count}: motion={motion_result['motion_detected']} pixels={motion_result['motion_pixels']} confidence={motion_result['confidence']}")

        if not motion_result["motion_detected"]:
            return

        print(f"[FramePipeline:{self._camera_id}] MOTION DETECTED — running YOLO")
        detections = self._run_detection(frame)
        if not detections:
            print(f"[FramePipeline:{self._camera_id}] YOLO returned 0 detections")
            return

        print(f"[FramePipeline:{self._camera_id}] YOLO: {len(detections)} detections: {[d['class'] for d in detections]}")
        tracked = self._tracker.update(detections)
        events = self._enrich_with_identity(tracked, frame)
        if events:
            print(f"[FramePipeline:{self._camera_id}] {len(detections)} detections → {len(tracked)} tracked → {len(events)} events")
        for ev in events:
            self._event_queue.put(ev)

    def _run_detection(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        if self._yolo_detector is None:
            return []
        return self._yolo_detector.detect(frame)

    def get_yolo_metrics(self) -> dict:
        if self._yolo_detector is None:
            return {}
        return self._yolo_detector.get_metrics()

    def _enrich_with_identity(self, tracked: List[Dict], frame: np.ndarray) -> List[Dict]:
        results = []
        for obj in tracked:
            if obj.get("event") == "track_ended":
                self._identity_cache.invalidate(obj["track_id"])
                results.append(obj)
                continue
            tid = obj["track_id"]
            if obj.get("event") == "track_started" and self._face_recognition_fn and len(obj.get("bbox", [])) == 4:
                cached = self._identity_cache.get(tid)
                if cached:
                    obj["identity"] = cached.get("name")
                    obj["identity_confidence"] = cached.get("confidence", 0)
                else:
                    bbox = obj["bbox"]
                    x, y, w, h = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
                    if w > 20 and h > 20:
                        try:
                            face_roi = frame[y : y + h, x : x + w]
                            name, conf = self._face_recognition_fn(face_roi)
                            self._identity_cache.put(tid, {"name": name, "confidence": conf})
                            obj["identity"] = name
                            obj["identity_confidence"] = conf
                        except Exception:
                            pass
            elif obj.get("identity") is None:
                cached = self._identity_cache.get(tid)
                if cached:
                    obj["identity"] = cached.get("name")
                    obj["identity_confidence"] = cached.get("confidence", 0)
            results.append(obj)
        return results
