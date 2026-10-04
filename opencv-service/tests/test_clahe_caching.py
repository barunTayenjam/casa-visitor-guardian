#!/usr/bin/env python3
"""InProcessYOLO must cache CLAHE objects, not recreate them every frame.

createCLAHE allocates a fresh OpenCV object per call; on the 3-CPU box this
churns the hot detection path. Both users (low-light pre-enhance at
clipLimit=3.0, HOG supplement at clipLimit=2.0) must reuse one instance
per detector.
"""
import numpy as np
from unittest import mock

import pytest

from rtsp_ingestion.frame_pipeline import InProcessYOLO


DARK_FRAME = np.full((480, 640, 3), 10, dtype=np.uint8)


@pytest.fixture
def dummy_detector(tmp_path):
    (tmp_path / 'yolov8n.onnx').write_bytes(b'')
    detector = InProcessYOLO(str(tmp_path))
    # Skip real model load; detect() only needs these set.
    detector._initialized = True
    detector._net = mock.MagicMock()
    # yolov5-style raw output: rows of [cx, cy, w, h, obj, ...scores]
    detector._net.forward.return_value = np.zeros((5, 10), dtype=np.float32)
    detector._model_type = 'yolov5'
    return detector


def _patched_clahe():
    """createCLAHE mock whose apply() echoes the input shape."""
    clahe = mock.MagicMock()
    clahe.apply.side_effect = lambda gray: np.zeros_like(gray)
    return mock.patch(
        'cv2.createCLAHE', mock.Mock(return_value=clahe)
    )


def test_detect_branch_reuses_cached_clahe(dummy_detector):
    """Low-light enhancement must call createCLAHE once, not once per frame."""
    with _patched_clahe() as mock_create:
        dummy_detector.detect(DARK_FRAME)
        dummy_detector.detect(DARK_FRAME)
        assert mock_create.call_count == 1, (
            f"createCLAHE called {mock_create.call_count} times for 2 frames, "
            "expected 1 (cached instance)"
        )


def test_hog_branch_reuses_cached_clahe(dummy_detector):
    """HOG supplement has its own CLAHE; also cached, also once."""
    dummy_detector._hog_supplement_enabled = True
    with _patched_clahe() as mock_create:
        dummy_detector.detect(DARK_FRAME)
        dummy_detector.detect(DARK_FRAME)
        # One detection-enhance instance + one HOG instance, each created once.
        assert mock_create.call_count == 2, (
            f"createCLAHE called {mock_create.call_count} times for 2 frames, "
            "expected 2 (one per cached instance)"
        )


if __name__ == '__main__':
    pytest.main([__file__])
