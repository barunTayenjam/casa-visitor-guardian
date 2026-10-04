#!/usr/bin/env python3
"""_on_live_frame must skip resize+JPEG encode when nobody is subscribed.

Encoding 640x360 JPEG on every reader frame costs real CPU on the 3-CPU box
even when the live WebSocket stream has zero viewers.
"""
import queue
import time

import numpy as np
import pytest

from rtsp_ingestion.frame_pipeline import FramePipeline
from rtsp_ingestion.queues import DropOldestQueue


class FakePublisher:
    def __init__(self):
        self._subscriptions = {}

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
    p._frame_counter = 0
    p._frame_skip = 1
    p._live_width = 640
    p._live_height = 360
    p._live_queue = p._publisher.add_frame_queue("cam_test")
    p._detection_queue = queue.Queue(maxsize=2)
    p._detect_interval = 1.0 / 2.0
    p._last_detect_enqueue = 0.0
    return p


def frame(ts=None):
    return {
        "data": np.full((360, 640, 3), 128, dtype=np.uint8),
        "timestamp": ts if ts is not None else time.time(),
        "camera_id": "cam_test",
    }


def test_no_encode_without_subscribers():
    """Zero subscribers → live queue stays empty (no encode cost)."""
    p = make_pipeline()
    assert p._publisher._subscriptions.get("cam_test") is None
    p._on_live_frame(frame())
    assert p._live_queue.qsize() == 0, (
        "JPEG encoded despite zero subscribers — encode not guarded"
    )


def test_encode_resumes_with_subscriber():
    """A live viewer must still get frames."""
    p = make_pipeline()
    p._publisher._subscriptions["cam_test"] = {"fake-ws"}
    p._on_live_frame(frame())
    assert p._live_queue.qsize() == 1
    assert p._live_queue.get_nowait()[:2] == b"\xff\xd8"


def test_detection_enqueue_unaffected_by_guard():
    """Motion detection must keep flowing even with no live viewers."""
    p = make_pipeline()
    t0 = 1000.0
    p._on_live_frame(frame(t0))
    p._on_live_frame(frame(t0 + p._detect_interval + 0.1))
    assert p._detection_queue.qsize() >= 1, (
        "detection frames lost when live stream has no subscribers"
    )


if __name__ == '__main__':
    pytest.main([__file__])
