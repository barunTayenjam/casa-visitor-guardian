#!/usr/bin/env python3
"""
Wave 5: YOLOv8 REST transpose bug in pipeline.YOLOObjectDetector._perform_yolo_detection.

YOLOv8 ONNX output is (1, 84, 8400): batch=1, 84 features (4 bbox + 80 classes),
8400 candidate boxes. The old heuristic `shape[0] != 1 and shape[0] != 8400` left
this shape UN-transposed, then unwrapped the batch dim to (84, 8400) and iterated
84 "detections" of 8400 columns each — garbage from every REST /detect-* endpoint.

Correct semantics (mirrors frame_pipeline.InProcessYOLO): unwrap the batch dim
first, then transpose only when the leading axis is smaller than the trailing one.
"""

import numpy as np

import state
from pipeline import YOLOObjectDetector

state.class_names = ["person", "car", "bicycle", "truck"]


def _make_detector(raw):
    """Detector wired to a fake net returning `raw` as the model output."""
    detector = YOLOObjectDetector.__new__(YOLOObjectDetector)
    detector.net = type("FakeNet", (), {"setInput": lambda self, b: None})()
    detector.net.forward = lambda *a: [raw]
    detector.layer_names = None
    detector.model_type = 'yolov8'
    detector.input_size = 640
    detector.confidence_threshold = 0.30
    detector.nms_threshold = 0.45
    detector.class_thresholds = {'person': 0.12, 'car': 0.30}
    detector.min_box_area = 800
    detector.min_box_width = 25
    detector.min_box_height = 25
    return detector


def _raw(shape, anchor, cx, cy, w, h, class_id, score):
    """Synthetic YOLOv8 output with one detection at `anchor`, in 640-input space."""
    raw = np.zeros(shape, dtype=np.float32)
    if len(shape) == 3:  # (1, 84, 8400) — features x candidates
        raw[0, 0, anchor] = cx
        raw[0, 1, anchor] = cy
        raw[0, 2, anchor] = w
        raw[0, 3, anchor] = h
        raw[0, 4 + class_id, anchor] = score
    else:  # (8400, 84) — candidates x features
        raw[anchor, 0] = cx
        raw[anchor, 1] = cy
        raw[anchor, 2] = w
        raw[anchor, 3] = h
        raw[anchor, 4 + class_id] = score
    return raw


IMAGE = np.full((360, 640, 3), 128, dtype=np.uint8)  # bright: no HOG/CLAHE path


def test_yolov8_batch_layout_transposed_before_iteration():
    """(1, 84, 8400) must yield the one planted person detection."""
    raw = _raw((1, 84, 8400), anchor=0, cx=320, cy=180, w=64, h=90, class_id=0, score=0.95)
    detections = _make_detector(raw)._perform_yolo_detection(IMAGE)

    assert len(detections) == 1, f"expected 1 detection, got {detections}"
    assert detections[0]["class"] == "person"
    assert detections[0]["confidence"] == 95.0


def test_yolov8_batch_layout_second_class():
    """Same layout, a car detection — class routing must survive the transpose."""
    raw = _raw((1, 84, 8400), anchor=5, cx=320, cy=180, w=64, h=90, class_id=1, score=0.88)
    detections = _make_detector(raw)._perform_yolo_detection(IMAGE)

    assert len(detections) == 1, f"expected 1 detection, got {detections}"
    assert detections[0]["class"] == "car"
    assert detections[0]["confidence"] == 88.0


def test_yolov8_canonical_layout_not_double_transposed():
    """(8400, 84) is already row-per-candidate — must not be transposed to garbage."""
    raw = _raw((8400, 84), anchor=0, cx=320, cy=180, w=64, h=90, class_id=0, score=0.95)
    detections = _make_detector(raw)._perform_yolo_detection(IMAGE)

    assert len(detections) == 1, f"expected 1 detection, got {detections}"
    assert detections[0]["class"] == "person"
    assert detections[0]["confidence"] == 95.0
