#!/usr/bin/env python3
"""
Tests for FramePipeline live/detect frame routing (_on_live_frame).

Covers:
- Live frames JPEG-encoded into live queue (frame_skip=1)
- Detection enqueue throttled to detect.fps (time-based), not reader fps
- Detection queue overflow drops frames without blocking the live path
"""

import queue
import time

import numpy as np
import pytest

from rtsp_ingestion.frame_pipeline import FramePipeline
from rtsp_ingestion.queues import DropOldestQueue


class FakePublisher:
    def __init__(self):
        # model the real publisher's subscription state — encode path is
        # guarded by subscriber presence, and these tests exercise encoding
        self._subscriptions = {"cam_test": {"fake-ws"}}

    def add_frame_queue(self, camera_id):
        return DropOldestQueue(2)

    def add_event_queue(self, camera_id):
        return DropOldestQueue(100)

    def queue_log(self, *a, **k):
        pass


def make_pipeline(detect_fps=2.0):
    p = object.__new__(FramePipeline)
    p._camera_id = "cam_test"
    p._publisher = FakePublisher()
    p._frame_counter = 0
    p._frame_skip = 1
    p._live_width = 640
    p._live_height = 360
    p._live_queue = p._publisher.add_frame_queue("cam_test")
    p._detection_queue = queue.Queue(maxsize=2)
    p._detect_interval = 1.0 / detect_fps
    p._last_detect_enqueue = 0.0
    return p


def frame(ts):
    return {"data": np.full((360, 640, 3), 128, dtype=np.uint8), "timestamp": ts, "camera_id": "cam_test"}


class TestLiveFrameRouting:
    def test_live_queue_receives_jpeg(self):
        p = make_pipeline()
        p._on_live_frame(frame(time.time()))
        assert p._live_queue.qsize() == 1
        payload = p._live_queue.get_nowait()
        assert payload[:2] == b"\xff\xd8"  # JPEG SOI marker

    def test_frame_skip_drops_live_encode(self):
        p = make_pipeline()
        p._frame_skip = 3
        for _ in range(3):
            p._on_live_frame(frame(time.time()))
        # counter % 3 == 0 fires only on 3rd frame
        assert p._live_queue.qsize() == 1

    def test_detection_throttled_to_detect_fps(self):
        p = make_pipeline(detect_fps=2.0)
        t0 = 1000.0
        # 15 frames over 0.5s (reader at live fps) — only t0 and t0+0.5+ enqueue
        for i in range(15):
            p._on_live_frame(frame(t0 + i * (0.5 / 14)))
        assert p._detection_queue.qsize() <= 2  # maxsize caps it anyway
        # drain and count actual enqueues over 1s window
        p2 = make_pipeline(detect_fps=2.0)
        for i in range(30):  # 30 frames over 1.0s at 30fps reader
            p2._on_live_frame(frame(t0 + i / 30.0))
        enqueued = 0
        while True:
            try:
                p2._detection_queue.get_nowait()
                enqueued += 1
            except queue.Empty:
                break
        assert enqueued == 2  # exactly detect.fps over 1s

    def test_detection_queue_overflow_never_raises(self):
        p = make_pipeline(detect_fps=1000.0)  # enqueue every frame
        # queue maxsize=2; flooding must not raise
        for i in range(100):
            p._on_live_frame(frame(2000.0 + i * 0.001))
        assert p._detection_queue.qsize() == 2
        # live path still delivered
        assert p._live_queue.qsize() == 2  # DropOldestQueue capped

    def test_live_path_survives_bad_frame_timestamp(self):
        p = make_pipeline()
        p._on_live_frame({"data": np.zeros((360, 640, 3), dtype=np.uint8), "timestamp": None, "camera_id": "cam_test"})
        assert p._live_queue.qsize() == 1
