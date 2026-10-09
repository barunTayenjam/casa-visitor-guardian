#!/usr/bin/env python3
"""
Wave 5: Quiet-period tracker bug in frame_pipeline.FramePipeline._process_detection.

When motion is not detected, _process_detection early-returns:

    if not motion_result["motion_detected"]:
        return

This skips tracker.update([]) — active tracks are never aged out, track_ended
never fires, IdentityCache entries leak, and the UI shows ghost faces after
a person leaves the scene during a motion drought.

Same skip happens when YOLO runs but filters drop every detection
(`if not detections: return` — also before tracker.update).

Fix: those paths must still call tracker.update([]) so lost tracks age out.
"""

import numpy as np
import queue

from rtsp_ingestion.frame_pipeline import (
    FramePipeline,
    IdentityCache,
    MotionGate,
)
from rtsp_ingestion.queues import DropOldestQueue


class _FakeAdaptive:
    def should_process_frame(self) -> bool:
        return True


class _FakeMotionGate:
    def __init__(self, detected: bool):
        self._detected = detected

    def detect(self, frame):
        return {
            "motion_detected": self._detected,
            "motion_pixels": 100 if self._detected else 0,
            "motion_percentage": 0.01,
            "confidence": 50.0 if self._detected else 0.0,
        }


class _RecordingTracker:
    """Records every update() call — asserts the pipeline actually calls it."""

    def __init__(self):
        self.calls: list = []

    def update(self, detections):
        self.calls.append(detections)
        return []


class _FakePublisher:
    def add_frame_queue(self, cid):
        return DropOldestQueue(10)

    def add_event_queue(self, cid):
        return DropOldestQueue(100)

    def queue_log(self, *a, **k):
        pass


def _make_pipeline(motion_detected: bool) -> FramePipeline:
    """Bare FramePipeline wired for _process_detection — no reader, no threads."""
    p = object.__new__(FramePipeline)
    p._camera_id = "cam_test"
    p._publisher = _FakePublisher()
    p._adaptive_frame_processor = _FakeAdaptive()
    p._motion_gate = _FakeMotionGate(motion_detected)
    p._tracker = _RecordingTracker()
    p._identity_cache = IdentityCache(ttl=30.0)
    p._detect_frame_count = 0
    p._yolo_min_interval = 0.0
    p._last_yolo_time = 0.0
    p._yolo_detector = None  # _run_detection returns [] when set
    p._yolo_max_input_width = 1280
    p._detect_width = 640
    p._detect_height = 360
    p._scene_frame_counter = 0
    p._scene_analysis_interval = 60
    p._last_scene_context = {}
    p._snapshotted_tracks = set()
    p._snapshot_paths = {}
    p._snapshot_dims = {}
    p._verify_cache = {}
    p._person_attrs_cache = {}
    p._event_queue = _FakePublisher().add_event_queue("cam_test")
    p._apply_camera_filters = lambda dets: dets  # no camera-object filter
    p._enrich_with_identity = lambda tracked, frame: tracked
    p._threat_detector = type("T", (), {"assess": staticmethod(lambda **k: {"level": "low", "confidence": 0, "reasoning": ""})})()
    p._last_threat = {}
    return p


def _frame():
    return np.full((360, 640, 3), 128, dtype=np.uint8)


def test_no_motion_still_updates_tracker():
    """Motion drought: tracker must still be called with [] so tracks age out."""
    p = _make_pipeline(motion_detected=False)

    p._process_detection(_frame())

    assert p._tracker.calls, (
        "tracker.update was never called during a no-motion frame — "
        "tracks can never end, IdentityCache never cleans"
    )
    assert p._tracker.calls[-1] == [], f"expected empty detections, got {p._tracker.calls}"


def test_motion_but_all_filtered_still_updates_tracker():
    """YOLO ran but filters dropped everything: tracker must still age tracks."""
    p = _make_pipeline(motion_detected=True)
    p._run_detection = lambda frame, roi=None: [{"bbox": [0, 0, 1, 1], "score": 0.01, "class": "noise", "class_id": 9}]
    p._apply_camera_filters = lambda dets: []  # filters drop all

    p._process_detection(_frame())

    assert p._tracker.calls, (
        "tracker.update was never called when all detections were filtered — "
        "tracks stuck forever"
    )
    assert p._tracker.calls[-1] == [], f"expected empty detections, got {p._tracker.calls}"


def test_published_bbox_is_scaled_to_the_snapshot_image():
    """Persisted bboxes must speak the snapshot's pixel space, not the detect frame's.

    YOLO runs on the go2rtc _low transcode (640x360, pinned in go2rtc.yaml) while
    the event JPEG is written from the full-res grab (2560x1440 on cam2). The
    events page scales a box by rendered/natural against that full-res image, so
    a detect-frame box lands in the top-left quarter of the picture. This locks
    the conversion in at publish time, where both spaces are known.
    """
    p = _make_pipeline(motion_detected=True)
    p._scene_frame_counter = 1
    p._run_detection = lambda frame, roi=None: [{"bbox": [0, 0, 10, 10], "score": 0.9, "class": "person", "class_id": 0}]
    p._apply_camera_filters = lambda dets: dets
    p._snapshot_dims = {7: (2560, 1440)}
    p._enrich_with_identity = lambda tracked, frame: [
        {"track_id": 7, "bbox": [472.5, 80, 54.9, 134.1], "file_path": "/app/snap.jpg"}
    ]

    p._process_detection(_frame())

    assert p._event_queue.qsize() == 1, "event was never published"
    published = p._event_queue.get_nowait()
    assert published["bbox"] == [1890.0, 320.0, 219.6, 536.4]


def test_published_bbox_without_a_snapshot_stays_in_detect_frame():
    """No file, no alignment: there is no image to express the box in."""
    p = _make_pipeline(motion_detected=True)
    p._scene_frame_counter = 1
    p._run_detection = lambda frame, roi=None: [{"bbox": [0, 0, 10, 10], "score": 0.9, "class": "person", "class_id": 0}]
    p._apply_camera_filters = lambda dets: dets
    p._snapshot_dims = {7: (2560, 1440)}
    p._enrich_with_identity = lambda tracked, frame: [{"track_id": 8, "bbox": [10, 20, 30, 40]}]

    p._process_detection(_frame())

    assert p._event_queue.get_nowait()["bbox"] == [10, 20, 30, 40]
