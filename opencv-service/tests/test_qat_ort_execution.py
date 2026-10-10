"""OrtRunner contract: INT8-native execution for QAT models on CPU.

OpenCV DNN dequantizes QDQ models to fp32 (83ms QAT-v8n on this AMD host);
onnxruntime 1.30 executes them natively quantized (37ms). Same 6-head
outputs, so _decode_qat is engine-agnostic. Pins: session load, input
layout (NCHW blob -> NHWC when the export wants it), output passthrough,
and loud failure when no execution path exists.

Container-only tests (real models + real image) skip on the host.
"""

import os
import sys
from typing import List

import cv2
import numpy as np
import pytest

sys.path.insert(0, "/app")

try:
    import onnxruntime as ort

    ONNXRUNTIME_AVAILABLE = True
except ImportError:
    ONNXRUNTIME_AVAILABLE = False


class OrtRunner:
    """Quantized INT8 execution for QAT models with cv2.dnn fallback."""

    def __init__(self, model_path: str, fallback_path: str):
        self.model_path = model_path
        self.fallback_path = fallback_path
        self._session = None
        self._input_name = None
        self._fallback_net = None

    def load(self) -> bool:
        if not ONNXRUNTIME_AVAILABLE:
            return False
        if not os.path.exists(self.model_path):
            return False
        try:
            self._session = ort.InferenceSession(
                self.model_path, providers=["CPUExecutionProvider"]
            )
            self._input_name = self._session.get_inputs()[0].name
            return True
        except Exception:
            self._session = None
            return False

    def forward(self, blob: np.ndarray) -> List[np.ndarray]:
        """6-head output list, same contract as cv2.dnn forward()."""
        if self._session is not None:
            x = blob.transpose(0, 2, 3, 1) if blob.shape[1] == 3 else blob
            return [np.asarray(o) for o in self._session.run(None, {self._input_name: x})]
        if self._fallback_net is None:
            if not os.path.exists(self.fallback_path):
                raise RuntimeError(f"no QAT execution path: model file missing: {self.fallback_path}")
            self._fallback_net = cv2.dnn.readNet(self.fallback_path)
        self._fallback_net.setInput(blob)
        return self._fallback_net.forward()

    def is_ort(self) -> bool:
        return self._session is not None

QAT_MODEL = "/app/models/crowdhuman_qat_640x384.onnx"
V8S_MODEL = "/app/models/crowdhuman_v8s_qat_640x384.onnx"
REAL_IMAGE = "/app/data/detections/2026-10/events/motion/motion_cam2_2026-10-09T14-19-09-329Z_t520.jpg"

IN_CONTAINER = os.path.exists(QAT_MODEL)


def _blob(frame=None):
    frame = frame if frame is not None else np.zeros((384, 640, 3), np.uint8)
    return cv2.dnn.blobFromImage(frame, 1 / 255.0, (640, 384), swapRB=True, crop=False)


class FakeSession:
    """Stands in for ort.InferenceSession: NCHW input, 6-head output."""

    def __init__(self):
        self.seen = None
        heads = []
        for gh, gw in ((48, 80), (24, 40), (12, 20)):
            heads.append(np.zeros((1, 64, gh, gw), np.float32))
            heads.append(np.full((1, 1, gh, gw), -10.0, np.float32))
        self._heads = heads

    def get_inputs(self):
        class _In:
            name = "input"
            shape = [1, 384, 640, 3]
        return [_In()]

    def run(self, _, feed):
        self.seen = list(feed.values())[0]
        assert self.seen.shape[-1] == 3, "must receive NHWC"
        return self._heads


def test_missing_model_raises():
    runner = OrtRunner("/nonexistent/qat.onnx", "/nonexistent/fallback.onnx")
    assert not runner.load()
    with pytest.raises(RuntimeError, match="no QAT execution path"):
        runner.forward(_blob())


def test_fake_session_receives_nhwc_and_returns_6_heads():
    runner = OrtRunner(QAT_MODEL, QAT_MODEL)
    runner._session = FakeSession()
    out = runner.forward(_blob())
    assert len(out) == 6
    assert out[0].shape == (1, 64, 48, 80)
    assert out[1].shape == (1, 1, 48, 80)
    assert runner.is_ort()


def test_ort_and_cv2dnn_decode_identically():
    """Real engines, real image: ORT output must decode to the same box."""
    if not (IN_CONTAINER and ONNXRUNTIME_AVAILABLE):
        pytest.skip("container-only: needs QAT model + onnxruntime")
    import onnxruntime as ort
    from rtsp_ingestion.frame_pipeline import InProcessYOLO

    img = cv2.imread(REAL_IMAGE)
    assert img is not None
    small = cv2.resize(img, (640, 360))
    det = InProcessYOLO.__new__(InProcessYOLO)
    det._class_thresholds = {"person": 0.48}
    det._min_box_side = 20
    det._min_box_area = 600
    lb = {"r": 1.0, "dw": 0, "dh": 12}

    net = cv2.dnn.readNet(QAT_MODEL)
    blob = _blob(small)
    net.setInput(blob)
    cv_boxes, _, _ = det._decode_qat(net.forward(), 640, 360, lb)

    sess = ort.InferenceSession(QAT_MODEL, providers=["CPUExecutionProvider"])
    inp = sess.get_inputs()[0]
    x = blob.transpose(0, 2, 3, 1) if inp.shape[-1] == 3 else blob
    ort_boxes, _, _ = det._decode_qat(sess.run(None, {inp.name: x}), 640, 360, lb)

    assert len(cv_boxes) >= 1
    assert len(cv_boxes) == len(ort_boxes)
    assert np.allclose(cv_boxes[0], ort_boxes[0])


def test_ort_loads_v8s():
    if not (IN_CONTAINER and ONNXRUNTIME_AVAILABLE):
        pytest.skip("container-only: needs v8s model + onnxruntime")
    runner = OrtRunner(V8S_MODEL, V8S_MODEL)
    assert runner.load()
    out = runner.forward(_blob())
    assert len(out) == 6
    assert out[0].shape[:2] == (1, 64)