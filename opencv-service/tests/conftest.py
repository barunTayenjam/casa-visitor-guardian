#!/usr/bin/env python3
"""
Shared pytest fixtures for RTSP ingestion tests.

Provides mock frame generators (random, blank, motion) and
a camera configuration fixture matching cameras.example.json format.
"""

pytest_plugins = ('pytest_asyncio',)

import numpy as np
import pytest


@pytest.fixture
def mock_frame() -> np.ndarray:
    """Generate a random noise frame simulating a camera frame."""
    return np.random.randint(0, 256, (360, 640, 3), dtype=np.uint8)


@pytest.fixture
def blank_frame() -> np.ndarray:
    """Generate a uniform gray frame for no-motion test scenarios."""
    return np.full((360, 640, 3), 128, dtype=np.uint8)


@pytest.fixture
def motion_frame(blank_frame: np.ndarray) -> np.ndarray:
    """Generate a frame with a white rectangle simulating a moving object.

    Draws a white rectangle at (100, 100, 50, 50) on a blank frame.
    """
    frame = blank_frame.copy()
    frame[100:150, 100:150] = (255, 255, 255)
    return frame


@pytest.fixture
def camera_config() -> dict:
    """Return a camera config dict matching cameras.example.json structure."""
    return {
        'id': 'test-cam',
        'name': 'Test Camera',
        'enabled': True,
        'streams': [
            {
                'path': 'rtsp://test:test@127.0.0.1:554/stream1',
                'roles': ['live', 'detect', 'record'],
                'width': 640,
                'height': 360,
                'fps': 5,
            },
        ],
    }
