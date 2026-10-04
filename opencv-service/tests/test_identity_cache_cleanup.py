#!/usr/bin/env python3
"""FramePipeline._detection_loop must periodically call _identity_cache.cleanup().

cleanup() removes expired TTL entries and is never invoked — unbounded growth
over hours of tracking. It must run alongside the existing scene-frame counter.
"""
import queue
import time
from unittest import mock

import pytest

import numpy as np

from rtsp_ingestion.frame_pipeline import FramePipeline, IdentityCache
from rtsp_ingestion.queues import DropOldestQueue


class FakePublisher:
    def add_frame_queue(self, camera_id):
        return DropOldestQueue(2)

    def add_event_queue(self, camera_id):
        return DropOldestQueue(100)

    def queue_log(self, *a, **k):
        pass


def make_pipeline():
    p = object.__new__(FramePipeline)
    p._camera_id = "cam_test"
    p._publisher = FakePublisher()
    p._live_queue = p._publisher.add_frame_queue("cam_test")
    p._event_queue = p._publisher.add_event_queue("cam_test")
    p._detection_queue = queue.Queue(maxsize=2)
    p._frame_counter = 0
    p._frame_skip = 1
    p._live_width = 640
    p._live_height = 360
    p._detect_interval = 0.0
    p._last_detect_enqueue = 0.0
    p._running = True
    p._scene_frame_counter = 0
    p._scene_analysis_interval = 60
    p._identity_cache = IdentityCache(ttl=30.0)
    p._tracker = mock.MagicMock()
    p._tracker.update.return_value = []
    p._threat_detector = mock.MagicMock()
    p._threat_detector.assess.return_value = {"threat": "none"}
    p._scene_analyzer = mock.MagicMock()
    p._scene_analyzer.analyze.return_value = {"scene_context": "outdoor"}
    p._snapshotted_tracks = set()
    p._snapshot_paths = {}
    p._verify_cache = {}
    p._person_attrs_cache = {}
    p._yolo_min_interval = 1.0
    p._last_yolo_time = 0.0
    p._yolo_max_input_width = 1280
    p._person_min_hits = 3
    p._person_min_conf = 0.55
    p._vehicle_min_hits = 3
    p._vehicle_min_conf = 0.45
    p._face_recognition_fn = None
    p._camera_config = {}
    p._queue_pipeline_log = lambda *a, **k: None
    p._apply_camera_filters = lambda d: d
    p._enrich_with_identity = lambda tracked, frame: tracked
    # Stub YOLO so detection loop doesn't need a model.
    p.__class__._yolo_detector = None
    return p


def test_identity_cache_cleanup_called_periodically():
    """cleanup() must be invoked at least once after N detection frames."""
    p = make_pipeline()
    p._adaptive_frame_processor = mock.MagicMock()
    p._adaptive_frame_processor.should_process_frame.return_value = True
    p._motion_gate = mock.MagicMock()
    p._motion_gate.detect.return_value = {"motion_detected": True, "motion_pixels": 100, "confidence": 0.9}
    p._detect_width, p._detect_height = 480, 360
    p._run_detection = mock.MagicMock(return_value=[{"bbox": [1, 1, 50, 50], "score": 0.8, "class": "person", "class_id": 0}])

    # Inject an expired entry into cache.
    p._identity_cache._store = {1: ({"name": "old"}, time.time() - 9999)}

    frame = np.full((360, 640, 3), 128, dtype=np.uint8)
    original_cleanup = p._identity_cache.cleanup
    calls = []
    def spy_cleanup():
        calls.append(1)
        original_cleanup()
    p._identity_cache.cleanup = spy_cleanup

    # Scene counter one frame away from the periodic tick.
    p._scene_frame_counter = 59
    p._process_detection(frame)

    assert len(calls) >= 1, (
        "IdentityCache.cleanup() never invoked — expired entries grow unbounded"
    )


if __name__ == '__main__':
    pytest.main([__file__])
