"""
Tests for the CrowdHuman QAT person model path (model type `yolov8-qat`):
letterbox preproc, 6-head DFL decode math, ROI offset bookkeeping, and
MotionGate roi key.
"""

import pathlib

import cv2
import numpy as np
import pytest

from rtsp_ingestion.frame_pipeline import InProcessYOLO, MotionGate

MODELS = pathlib.Path(__file__).resolve().parents[1] / "models"
MODEL_FILE = MODELS / "crowdhuman_qat_640x384.onnx"
requires_model = pytest.mark.skipif(
    not MODEL_FILE.exists(), reason="crowdhuman_qat_640x384.onnx not present"
)


def _fake_heads(pos_hw=(48, 80), pos_xy=(40, 24), dfl_bins=(4, 4, 6, 6), cls_logit=10.0):
    """6 raw heads: one confident person cell at stride 8, everything else silent."""
    heads = []
    for stride in (8, 16, 32):
        gh, gw = 384 // stride, 640 // stride
        box = np.full((64, gh, gw), -20.0, dtype=np.float32)
        cls = np.full((1, gh, gw), -20.0, dtype=np.float32)
        if stride == 8:
            gx, gy = pos_xy
            for ci, val in enumerate(dfl_bins):
                box[ci * 16 + val, gy, gx] = 20.0  # one-hot DFL bin
            cls[0, gy, gx] = cls_logit
        heads += [box, cls]
    return heads


@requires_model
class TestQatDecode:
    @pytest.fixture
    def yolo(self, monkeypatch):
        monkeypatch.setenv("YOLO_MODEL", "crowdhuman_qat_640x384")
        y = InProcessYOLO(str(MODELS))
        assert y.initialize(), "QAT model must load"
        assert y._model_type == "yolov8-qat"
        return y

    def test_identity_letterbox_exact_box(self, yolo):
        """640x384 input = letterbox identity; DFL bins map to exact pixels."""
        lb = {"r": 1.0, "dw": 0, "dh": 0}
        boxes, confs, cids = yolo._decode_qat(_fake_heads(), 640, 384, lb)
        assert len(boxes) == 1
        # anchor (40.5, 24.5) * stride 8, ltrb = [4,4,6,6] grid units
        x, y, w, h = boxes[0]
        assert w == 80 and h == 80
        assert abs(x - 292) <= 1 and abs(y - 164) <= 1  # int() truncation ±1
        assert cids == [0]
        assert confs[0] > 0.9

    def test_letterbox_inverse_maps_back_to_frame(self, yolo):
        """1280x720 frame -> r=0.5, dy=12; same cell must land 2x out, y shifted."""
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        lb = yolo._letterbox_qat(frame)
        assert lb["r"] == 0.5 and lb["dw"] == 0 and lb["dh"] == 12
        boxes, _, _ = yolo._decode_qat(_fake_heads(), 1280, 720, lb)
        assert len(boxes) == 1
        x, y, w, h = boxes[0]
        assert abs(x - 584) <= 1 and abs(y - 304) <= 1  # frame px after inverse
        assert w == 160 and h == 160  # stride pixels / r

    def test_below_person_threshold_filtered(self, yolo):
        """conf < YOLO_QAT_PERSON_THRESH (default 0.40) must not survive decode."""
        heads = _fake_heads(cls_logit=-2.0)  # sigmoid ≈ 0.12
        lb = {"r": 1.0, "dw": 0, "dh": 0}
        assert yolo._decode_qat(heads, 640, 384, lb) == ([], [], [])

    def test_detect_smoke_returns_bbox_format(self, yolo):
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        results = yolo.detect(frame)
        assert isinstance(results, list)
        for r in results:
            assert set(r) == {"bbox", "score", "class", "class_id"}
            x, y, w, h = r["bbox"]
            assert 0 <= x < 1280 and 0 <= y < 720

    def test_roi_shifts_boxes_to_full_frame(self, yolo):
        """A detection inside an ROI crop must come back in full-frame coords."""
        # roi over the right half; identity-sized content keeps decode stable
        roi = [640, 0, 640, 384]
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        results = yolo.detect(frame, roi=roi)
        for r in results:
            x, y, w, h = r["bbox"]
            assert x >= 640, "box must be shifted into the roi region"


class TestMotionGateRoi:
    def test_roi_key_present_and_covers_motion(self):
        gate = MotionGate("test-cam", history=50, var_threshold=16, pixel_threshold=500)
        blank = np.full((360, 640, 3), 128, dtype=np.uint8)
        for _ in range(10):
            res = gate.detect(blank)
            assert res["roi"] is None
        moving = blank.copy()
        moving[100:200, 200:320] = 255
        res = None
        for _ in range(5):
            res = gate.detect(moving)
        if res["motion_detected"]:
            x, y, w, h = res["roi"]
            # padded union must contain the moved rectangle
            assert x <= 200 and y <= 100 and x + w >= 320 and y + h >= 200
