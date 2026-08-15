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

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    print("[FramePipeline] psutil not available, frame skipping disabled")

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
    GO2RTC_RTSP_BASE,
)
from .queues import DropOldestQueue, DropIfFullQueue
from .ffmpeg_reader import FFmpegReader
from .websocket_publisher import WebSocketPublisher
from .byte_tracker import ByteTracker
from scene_analyzer import SceneAnalyzer
from person_analyzer import PersonAnalyzer
from threat_detector import ThreatDetector
from person_verifier import HumanVerifier


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


class AdaptiveFrameProcessor:
    """Dynamically skip detection frames under high CPU load."""

    def __init__(self):
        self.cpu_threshold_high = 80
        self.cpu_threshold_low = 60
        self.skip_interval = 3
        self.frame_count = 0
        self.is_skipping = False
        self.resume_timer = 0

    def should_process_frame(self) -> bool:
        if not PSUTIL_AVAILABLE:
            return True

        cpu_usage = psutil.cpu_percent(interval=0.1)

        if cpu_usage > self.cpu_threshold_high:
            self.is_skipping = True
            self.resume_timer = 0
        elif cpu_usage < self.cpu_threshold_low:
            self.resume_timer += 1
            if self.resume_timer > 5:
                self.is_skipping = False

        if self.is_skipping:
            self.frame_count += 1
            return self.frame_count % self.skip_interval == 0

        return True


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
        self._confidence_threshold = 0.15
        self._nms_threshold = 0.45
        # Expanded relevant classes for richer scene understanding.
        self._relevant_classes = {
            "person", "car", "truck", "bus", "motorcycle", "bicycle",
            "dog", "cat", "bird", "horse",
            "backpack", "umbrella", "handbag", "suitcase",
            "frisbee", "skateboard",
            "bottle", "cup", "cell phone",
            "chair", "couch", "potted plant", "bed", "dining table",
            "tv", "laptop", "keyboard", "mouse", "remote", "book",
            "vase", "clock", "teddy bear",
            "traffic light", "stop sign", "parking meter", "bench",
            "fire hydrant",
        }
        self._class_thresholds = {
            "person": 0.20, "car": 0.35, "truck": 0.40, "bus": 0.40,
            "motorcycle": 0.40, "bicycle": 0.40, "dog": 0.20, "cat": 0.20,
            "bird": 0.20, "horse": 0.40, "backpack": 0.40, "umbrella": 0.45,
            "handbag": 0.45, "suitcase": 0.45, "cell phone": 0.45,
            "chair": 0.45, "couch": 0.45, "potted plant": 0.50,
            "tv": 0.45, "laptop": 0.45, "book": 0.45, "clock": 0.45,
            "bowl": 0.35, "bottle": 0.45,
            "traffic light": 0.40, "stop sign": 0.40, "bench": 0.40,
        }
        self._default_threshold = 0.50
        self._min_box_area = 1500
        self._min_box_side = 35
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

        free_memory_gb = 0
        if PSUTIL_AVAILABLE:
            free_memory_gb = psutil.virtual_memory().available / (1024**3)

        gpu_available = False
        try:
            device_count = cv2.cuda.getCudaEnabledDeviceCount()
            gpu_available = device_count > 0
        except (AttributeError, cv2.error):
            pass

        if gpu_available:
            model_priority = [("yolov8n.onnx", "yolov8"), ("yolov8s.onnx", "yolov8"), ("yolov8m.onnx", "yolov8"), ("yolov5n.onnx", "yolov5")]
        elif free_memory_gb > 2.0:
            model_priority = [("yolov8n.onnx", "yolov8"), ("yolov5n.onnx", "yolov5")]
        else:
            model_priority = [("yolov5n.onnx", "yolov5"), ("yolov4-tiny.weights", "yolov4")]

        for filename, mtype in model_priority:
            if mtype == "yolov4":
                weights = os.path.join(self._models_dir, filename)
                cfg = os.path.join(self._models_dir, "yolov4-tiny.cfg")
                if os.path.exists(weights) and os.path.exists(cfg):
                    self._net = cv2.dnn.readNet(weights, cfg)
                    self._model_type = mtype
                    backend, target, label = self._detect_backend()
                    self._net.setPreferableBackend(backend)
                    self._net.setPreferableTarget(target)
                    self._backend_label = label
                    self._initialized = True
                    print(f"[InProcessYOLO] {mtype} initialized with {label} backend (free RAM: {free_memory_gb:.1f}GB)")
                    return True
            else:
                path = os.path.join(self._models_dir, filename)
                if os.path.exists(path):
                    self._net = cv2.dnn.readNet(path)
                    backend, target, label = self._detect_backend()
                    self._net.setPreferableBackend(backend)
                    self._net.setPreferableTarget(target)
                    self._backend_label = label
                    self._model_type = mtype
                    self._initialized = True
                    print(f"[InProcessYOLO] {mtype} initialized with {label} backend (free RAM: {free_memory_gb:.1f}GB)")
                    return True

        return False

    _inference_lock = __import__("threading").Lock()

    def detect(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        if not self._initialized or self._net is None:
            return []
        
        with self._inference_lock:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            orig_mean = np.mean(gray)
            if orig_mean < 120:
                clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
                enhanced_gray = clahe.apply(gray)
                enhanced = cv2.cvtColor(enhanced_gray, cv2.COLOR_GRAY2BGR)
                frame = cv2.addWeighted(frame, 0.3, enhanced, 0.7, 0)

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
            if len(output.shape) == 3 and output.shape[0] == 1:
                output = output[0]
            if self._model_type == "yolov8" and output.shape[0] < output.shape[1]:
                output = output.transpose()
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
                if cname not in self._relevant_classes:
                    continue
                thresh = self._class_thresholds.get(cname, self._default_threshold)
                if conf < thresh:
                    continue
                cx, cy, bw, bh = det[0], det[1], det[2], det[3]
                sx, sy = w / self._input_size, h / self._input_size
                x = int((cx - bw / 2) * sx)
                y = int((cy - bh / 2) * sy)
                bw = int(bw * sx)
                bh = int(bh * sy)
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

        has_person = any(r["class"] == "person" for r in results)
        if orig_mean < 120 and not has_person:
            hog_persons = self._hog_person_supplement(frame)
            for hp in hog_persons:
                bx, by, bw, bh = hp["bbox"]
                overlap = False
                for r in results:
                    rx, ry, rw, rh = r["bbox"]
                    ix1, iy1 = max(bx, rx), max(by, ry)
                    ix2, iy2 = min(bx + bw, rx + rw), min(by + bh, ry + rh)
                    if ix2 > ix1 and iy2 > iy1:
                        inter = (ix2 - ix1) * (iy2 - iy1)
                        union = bw * bh + rw * rh - inter
                        if union > 0 and inter / union > 0.3:
                            overlap = True
                            break
                if not overlap:
                    results.append(hp)
                    print(f"  [InProcessYOLO] HOG supplement: person at {hp['bbox']}")
        return results

    def _hog_person_supplement(self, frame: np.ndarray) -> List[Dict]:
        results = []
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)

            hog = cv2.HOGDescriptor()
            hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

            for scale, stride in [(1.05, 8), (1.03, 4)]:
                rects, weights = hog.detectMultiScale(
                    enhanced, winStride=(stride, stride),
                    padding=(8, 8), scale=scale,
                )
                for (x, y, w, h), weight in zip(rects, weights):
                    score = min(0.99, max(0.15, weight))
                    if score >= 0.20:
                        results.append({
                            "bbox": [int(x), int(y), int(w), int(h)],
                            "score": round(score, 4),
                            "class": "person",
                            "class_id": 0,
                        })

            deduped = []
            for r in results:
                bx, by, bw, bh = r["bbox"]
                dup = False
                for d in deduped:
                    dx, dy, dw, dh = d["bbox"]
                    ix, iy = max(bx, dx), max(by, dy)
                    ix2, iy2 = min(bx + bw, dx + dw), min(by + bh, dy + dh)
                    if ix2 > ix and iy2 > iy:
                        inter = (ix2 - ix) * (iy2 - iy)
                        union = bw * bh + dw * dh - inter
                        if union > 0 and inter / union > 0.5:
                            dup = True
                            break
                if not dup:
                    deduped.append(r)
            return deduped
        except Exception as e:
            print(f"[InProcessYOLO] HOG error: {e}")
            return []

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
        frame_skip: int = 2,
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
        self._scene_analyzer = SceneAnalyzer()
        self._scene_analysis_interval = 60
        self._scene_frame_counter = 0
        self._last_scene_context = {}
        self._person_analyzer = PersonAnalyzer()
        self._threat_detector = ThreatDetector()
        self._threat_detector.set_camera_config(camera_config)
        self._last_threat: Dict[str, Any] = {}
        self._adaptive_frame_processor = AdaptiveFrameProcessor()

        live_cfg = self._config.get("live", {})
        self._live_width = live_cfg.get("width", LIVE_WIDTH)
        self._live_height = live_cfg.get("height", LIVE_HEIGHT)

        detect_cfg = self._config.get("detect", {})
        self._detect_width = detect_cfg.get("width", DETECT_WIDTH)
        self._detect_height = detect_cfg.get("height", DETECT_HEIGHT)

        # Single reader per camera — go2rtc re-streams the camera's sole RTSP
        # connection to any number of consumers internally, so we only need
        # one FFmpeg process. The live callback splits frames to both queues.
        go2rtc_url = f"{GO2RTC_RTSP_BASE}/{self._camera_id}"

        self._live_reader = FFmpegReader(
            rtsp_url=go2rtc_url,
            camera_id=self._camera_id,
            width=self._live_width,
            height=self._live_height,
            fps=live_cfg.get("fps", DEFAULT_FPS),
            scale=False,
        )
        self._detect_reader = None

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
        self._live_reader.start(self._on_live_frame)
        print(f"[FramePipeline:{self._camera_id}] Started (single reader, live+detect)")

    def start_live(self) -> None:
        pass

    def stop_live(self) -> None:
        pass

    def stop(self) -> None:
        self._running = False
        self._live_reader.stop()
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

        small = cv2.resize(frame, (self._detect_width, self._detect_height), interpolation=cv2.INTER_AREA)
        try:
            self._detection_queue.put_nowait(small)
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
        if not self._adaptive_frame_processor.should_process_frame():
            return

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

        self._scene_frame_counter += 1
        if self._scene_frame_counter % self._scene_analysis_interval == 0:
            self._last_scene_context = self._scene_analyzer.analyze(frame, detections)
            print(f"[FramePipeline:{self._camera_id}] Scene: {self._last_scene_context['scene_context']}")

        print(f"[FramePipeline:{self._camera_id}] YOLO: {len(detections)} detections: {[d['class'] for d in detections]}")
        tracked = self._tracker.update(detections)
        events = self._enrich_with_identity(tracked, frame)

        person_attrs = []
        for ev in events:
            if ev.get("class") == "person" and ev.get("clothing"):
                person_attrs.append(ev)

        threat = self._threat_detector.assess(
            detections=tracked,
            scene_context=self._last_scene_context.get("scene_context", {}),
            person_attributes=person_attrs,
            camera_id=self._camera_id,
            frame=frame,
        )
        self._last_threat = threat

        if events:
            for ev in events:
                ev["scene_context"] = self._last_scene_context.get("scene_context", {})
                ev["detection_summary"] = self._last_scene_context.get("detection_summary", {})
                ev["threat_assessment"] = threat
            if threat["level"] != "low":
                print(f"[FramePipeline:{self._camera_id}] THREAT: {threat['level']} ({threat['confidence']}%) — {threat['reasoning'][:100]}")
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

    _uniface_analyzer = None
    _uniface_init_lock = __import__("threading").Lock()

    @classmethod
    def _get_uniface(cls):
        """Singleton FaceAnalyzer — model load is expensive, never per-call."""
        with cls._uniface_init_lock:
            if cls._uniface_analyzer is None:
                from uniface import FaceAnalyzer
                cls._uniface_analyzer = FaceAnalyzer()
            return cls._uniface_analyzer

    _human_verifier = None
    _human_verifier_init_lock = __import__("threading").Lock()

    @classmethod
    def _get_human_verifier(cls):
        with cls._human_verifier_init_lock:
            if cls._human_verifier is None:
                cls._human_verifier = HumanVerifier()
            return cls._human_verifier

    def _enrich_with_identity(self, tracked: List[Dict], frame: np.ndarray) -> List[Dict]:
        results = []
        person_attrs_cache = {}
        for obj in tracked:
            if obj.get("event") == "track_ended":
                self._identity_cache.invalidate(obj["track_id"])
                results.append(obj)
                continue
            tid = obj["track_id"]
            bbox = obj.get("bbox", [0, 0, 0, 0])
            if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
                x, y, w_b, h_b = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
            else:
                x, y, w_b, h_b = 0, 0, 0, 0

            # --- HUMAN VERIFICATION ---
            # Now uses MediaPipe pose keypoints + face check (HumanVerifier)
            # instead of uniface face-only + Haar fallback.
            if obj.get("class") == "person" and w_b > 20 and h_b > 20:
                person_roi = frame[max(0, y):min(frame.shape[0], y + h_b), max(0, x):min(frame.shape[1], x + w_b)]
                if person_roi.size > 0:
                    human = self._get_human_verifier().verify(person_roi, yolo_score=obj.get("score", 0))
                    if human:
                        obj["human_verified"] = True
                    else:
                        print(f"[FramePipeline] Discarding false positive person: {tid}")
                        continue
            # ---------------------------

            if obj.get("event") == "track_started" and self._face_recognition_fn and w_b > 20 and h_b > 20:
                cached = self._identity_cache.get(tid)
                if cached:
                    obj["identity"] = cached.get("name")
                    obj["identity_confidence"] = cached.get("confidence", 0)
                else:
                    try:
                        face_roi = frame[y : y + h_b, x : x + w_b]
                        name, conf = self._face_recognition_fn(face_roi)
                        self._identity_cache.put(tid, {"name": name, "confidence": conf})
                        obj["identity"] = name
                        obj["identity_confidence"] = conf
                    except Exception:
                        pass

            if obj.get("class") == "person" and w_b > 20 and h_b > 20:
                cache_key = tid if tid else str(id(obj))
                if cache_key not in person_attrs_cache:
                    try:
                        person_roi = frame[max(0, y):min(frame.shape[0], y + h_b), max(0, x):min(frame.shape[1], x + w_b)]
                        if person_roi.size > 0:
                            analysis = self._person_analyzer.analyze_persons(frame, [obj])
                            if analysis["people"]:
                                person_attrs_cache[cache_key] = analysis["people"][0]
                    except Exception:
                        pass
                if cache_key in person_attrs_cache:
                    attrs = person_attrs_cache[cache_key]
                    obj["clothing"] = attrs.get("clothing", "unknown")
                    obj["clothing_colors"] = attrs.get("clothing_colors", [])
                    obj["facing"] = attrs.get("facing", "unknown")
                    obj["distance"] = attrs.get("estimatedAge", "unknown")
                    obj["carrying_item"] = attrs.get("carryingItem", "none")
                    obj["body_language"] = attrs.get("bodyLanguage", "neutral")

            elif obj.get("identity") is None:
                cached = self._identity_cache.get(tid)
                if cached:
                    obj["identity"] = cached.get("name")
                    obj["identity_confidence"] = cached.get("confidence", 0)
            results.append(obj)
        return results
