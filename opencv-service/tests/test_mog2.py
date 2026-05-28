#!/usr/bin/env python3
"""
Tests for MOG2 motion gate using OpenCV background subtraction.

Tests run against the OpenCV MOG2 bg subtractor directly since
the actual MotionGate class is implemented in Plan 01-03.
"""

import cv2
import numpy as np
import pytest


@pytest.fixture
def mog2():
    """Create a MOG2 background subtractor with standard parameters."""
    return cv2.createBackgroundSubtractorMOG2(
        history=200,
        varThreshold=16,
        detectShadows=False,
    )


@pytest.fixture
def blank_frame_640_360():
    """Generate a uniform gray 640x360 frame."""
    return np.full((360, 640, 3), 128, dtype=np.uint8)


class TestMOG2MotionGate:
    """MOG2 background subtraction: motion detection behavior."""

    def test_mog2_detects_motion(self, mog2, blank_frame_640_360):
        """After initializing with blank frames, a white rectangle triggers motion."""
        # Initialize background model with two blank frames
        for _ in range(2):
            mog2.apply(blank_frame_640_360)

        # Create a motion frame with a white rectangle
        motion_frame = blank_frame_640_360.copy()
        motion_frame[100:150, 100:150] = (255, 255, 255)

        fg_mask = mog2.apply(motion_frame)
        motion_pixels = cv2.countNonZero(fg_mask)

        assert motion_pixels > 500, (
            f"Expected >500 motion pixels, got {motion_pixels}"
        )

    def test_mog2_no_motion_on_static(self, mog2, blank_frame_640_360):
        """With repeated identical frames, background model converges to near-zero."""
        for _ in range(5):
            fg_mask = mog2.apply(blank_frame_640_360)

        motion_pixels = cv2.countNonZero(fg_mask)

        assert motion_pixels < 1000, (
            f"Expected near-zero motion on static scene, got {motion_pixels}"
        )

    def test_mog2_motion_threshold(self, mog2, blank_frame_640_360):
        """Motion crosses threshold=500 with clear motion but not with noise."""
        # Initialize with blanks
        for _ in range(2):
            mog2.apply(blank_frame_640_360)

        # Apply a noiseless blank frame — should be below threshold
        still_mask = mog2.apply(blank_frame_640_360)
        still_pixels = cv2.countNonZero(still_mask)

        # Apply frame with clear motion
        motion_frame = blank_frame_640_360.copy()
        motion_frame[100:150, 100:150] = (255, 255, 255)
        motion_mask = mog2.apply(motion_frame)
        motion_pixels = cv2.countNonZero(motion_mask)

        assert motion_pixels > still_pixels, (
            f"Motion frame ({motion_pixels}) should produce more motion pixels "
            f"than still frame ({still_pixels})"
        )
        assert motion_pixels > 500, (
            f"Motion should cross 500 threshold, got {motion_pixels}"
        )
