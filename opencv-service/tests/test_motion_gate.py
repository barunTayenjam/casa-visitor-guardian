"""
Tests for MotionGate — per-camera MOG2 wrapper with warmup and threshold logic.
"""

import cv2
import numpy as np
import pytest

from rtsp_ingestion.frame_pipeline import MotionGate


class TestMotionGate:
    """MotionGate: MOG2 motion gate with warmup period."""

    @pytest.fixture
    def gate(self):
        return MotionGate("test-cam", history=50, var_threshold=16, pixel_threshold=500)

    @pytest.fixture
    def blank(self):
        return np.full((360, 640, 3), 128, dtype=np.uint8)

    def test_warmup_returns_no_motion(self, gate, blank):
        """First 10 frames should report no motion regardless of content."""
        for _ in range(10):
            result = gate.detect(blank)
            assert result['motion_detected'] is False

    def test_detects_motion_after_warmup(self, gate, blank):
        """After warmup, a bright rectangle triggers motion."""
        for _ in range(12):
            gate.detect(blank)

        motion_frame = blank.copy()
        motion_frame[100:150, 100:150] = (255, 255, 255)
        result = gate.detect(motion_frame)

        assert result['motion_detected'] is True
        assert result['motion_pixels'] > 500
        assert result['confidence'] > 0

    def test_no_motion_on_static_scene(self, gate, blank):
        """Repeated identical frames produce no motion after warmup."""
        for _ in range(15):
            result = gate.detect(blank)

        assert result['motion_detected'] is False
        assert result['confidence'] == 0.0

    def test_confidence_increases_with_motion(self, gate, blank):
        """More motion produces higher confidence."""
        for _ in range(12):
            gate.detect(blank)

        # Small motion
        small = blank.copy()
        small[100:120, 100:120] = (255, 255, 255)
        small_result = gate.detect(small)

        # Large motion
        large = blank.copy()
        large[50:200, 50:200] = (255, 255, 255)
        large_result = gate.detect(large)

        assert small_result['confidence'] <= large_result['confidence']
