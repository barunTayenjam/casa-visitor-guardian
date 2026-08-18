#!/usr/bin/env python3
"""HumanVerifier — MediaPipe pose detector for human-presence verification.

Replaces face-only uniface (which discarded back-facing persons — 19/20
false-head in testing). Verified here: skeleton of a person exists even when
only the back or partial body is visible.

Config:
    HUMAN_VERIFIER_ENABLED    (default 1)  master switch
    HUMAN_VERIFIER_KEEP_BACK_FACING (default 1)  keep persons with no face
    HUMAN_VERIFIER_MIN_KEYPOINTS (default 3)  min pose keypoints to count as human
    HUMAN_VERIFIER_SCORE      (default 0.75) YOLO score floor when no face/pose evidence
"""

import os
import threading
import cv2
import numpy as np


class HumanVerifier:
    def __init__(self):
        self._pose = None
        self._face_analyzer = None
        self._lock = threading.Lock()
        self.enabled = int(os.environ.get("HUMAN_VERIFIER_ENABLED", "1"))
        self.keep_back_facing = int(os.environ.get("HUMAN_VERIFIER_KEEP_BACK_FACING", "1"))
        self.min_keypoints = int(os.environ.get("HUMAN_VERIFIER_MIN_KEYPOINTS", "3"))
        self.score_floor = float(os.environ.get("HUMAN_VERIFIER_SCORE", "0.75"))

    @property
    def pts(self):
        with self._lock:
            if self._pose is None:
                try:
                    import mediapipe as mp
                    self._pose = mp.solutions.pose.Pose(
                        static_image_mode=False,
                        model_complexity=1,
                        smooth_landmarks=True,
                        min_detection_confidence=0.5,
                        min_tracking_confidence=0.5,
                    )
                except Exception:
                    self._pose = False
            return self._pose

    @property
    def face_analyzer(self):
        with self._lock:
            if self._face_analyzer is None:
                try:
                    from uniface import FaceAnalyzer
                    self._face_analyzer = FaceAnalyzer()
                except ImportError:
                    self._face_analyzer = False
            return self._face_analyzer

    def verify(self, roi: np.ndarray, yolo_score: float) -> bool:
        """Return True if ROI contains a human. Tiered check (avoid false negatives).
        1) YOLO score >= 0.9 → trust it completely.
        2) Face verification via uniface.
        3) Pose keypoints via MediaPipe (accept min_keypoints minimum).
        4) Fallback to YOLO score threshold.
        """
        if not self.enabled:
            return True

        # Tier 1: High YOLO confidence → trust it completely.
        if yolo_score >= 0.9:
            return True

        # Small ROIs (640x360 detection frames) starve face/pose models — upscale.
        if roi.shape[0] > 0 and roi.shape[0] < 96:
            scale = 128.0 / roi.shape[0]
            roi = cv2.resize(
                roi,
                (max(1, int(roi.shape[1] * scale)), 128),
                interpolation=cv2.INTER_LINEAR,
            )

        # Tier 2: Face verification via uniface.
        fa = self.face_analyzer
        if fa is not False:
            try:
                if fa.analyze(roi):
                    return True
            except Exception:
                pass

        # Tier 3: Pose keypoints via MediaPipe.
        mp = self.pts
        if mp is not False:
            rgb = cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)
            results = mp.process(rgb)
            if results and results.pose_landmarks:
                n = sum(1 for lm in results.pose_landmarks.landmark if lm.visibility > 0.2)
                if n >= self.min_keypoints or (not self.keep_back_facing and n >= 1):
                    return True

        # Tier 4: Fallback to YOLO confidence threshold.
        return yolo_score >= self.score_floor