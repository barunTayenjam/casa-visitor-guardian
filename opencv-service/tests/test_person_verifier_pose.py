#!/usr/bin/env python3
"""
HumanVerifier must stop discarding the landmarks it already computes.

MediaPipe Pose returns 33 landmarks per person. The verifier reduced them to a
visibility count and threw the rest away:

    n = sum(1 for lm in results.pose_landmarks.landmark if lm.visibility > 0.2)

The measured stance, facing and arm position were all recoverable from data the
verifier already had in hand, at no extra inference cost. These tests pin that
the verdict now carries them, and that the existing contract Node depends on
(`keypoints`, `face_detected`, `tier`) is untouched.
"""

import numpy as np
import pytest

from person_verifier import HumanVerifier

NOSE = 0
L_EYE, R_EYE = 2, 5
L_EAR, R_EAR = 7, 8
L_SHOULDER, R_SHOULDER = 11, 12
L_WRIST, R_WRIST = 15, 16
L_HIP, R_HIP = 23, 24
L_ANKLE, R_ANKLE = 27, 28

VIS = 0.95


class Landmark:
    def __init__(self, x, y, z=0.0, visibility=VIS):
        self.x, self.y, self.z, self.visibility = x, y, z, visibility


class FakeLandmarks:
    def __init__(self, landmarks):
        self.landmark = landmarks


class FakeResult:
    def __init__(self, landmarks):
        self.pose_landmarks = FakeLandmarks(landmarks)


class FakePose:
    """Stands in for mp.solutions.pose.Pose — returns landmarks, no inference."""

    def __init__(self, landmarks):
        self._landmarks = landmarks

    def process(self, rgb):
        return FakeResult(self._landmarks)


def standing_skeleton(shoulder_y=0.30, hip_y=0.55, ankle_y=0.95, wrist_y=0.45, shoulder_w=0.16):
    lm = [Landmark(0.5, 0.5, visibility=0.0) for _ in range(33)]
    lm[NOSE] = Landmark(0.5, shoulder_y - 0.10)
    lm[L_EYE] = Landmark(0.49, shoulder_y - 0.11)
    lm[R_EYE] = Landmark(0.51, shoulder_y - 0.11)
    lm[L_EAR] = Landmark(0.47, shoulder_y - 0.10)
    lm[R_EAR] = Landmark(0.53, shoulder_y - 0.10)
    lm[L_SHOULDER] = Landmark(0.5 - shoulder_w / 2, shoulder_y)
    lm[R_SHOULDER] = Landmark(0.5 + shoulder_w / 2, shoulder_y)
    lm[L_WRIST] = Landmark(0.5 - shoulder_w / 2, wrist_y)
    lm[R_WRIST] = Landmark(0.5 + shoulder_w / 2, wrist_y)
    lm[L_HIP] = Landmark(0.45, hip_y)
    lm[R_HIP] = Landmark(0.55, hip_y)
    lm[L_ANKLE] = Landmark(0.45, ankle_y)
    lm[R_ANKLE] = Landmark(0.55, ankle_y)
    return lm


@pytest.fixture
def verifier(monkeypatch):
    monkeypatch.setenv("HUMAN_VERIFIER_ENABLED", "1")
    monkeypatch.setenv("HUMAN_VERIFIER_SCORE", "0.55")
    monkeypatch.setenv("HUMAN_VERIFIER_NIGHT_SCORE", "0.55")
    v = HumanVerifier()
    # uniface is not consulted: no face means the pose tier is what fires.
    # `face_analyzer` is a read-only property, so set the backing field.
    v._face_analyzer = False
    return v


def roi():
    return np.full((256, 192, 3), 90, dtype=np.uint8)


def test_verdict_carries_measured_pose(verifier):
    verifier._pose = FakePose(standing_skeleton())

    verdict = verifier.verify_detailed(roi(), yolo_score=0.65)

    assert verdict["pose"]["stance"] == "standing"
    assert verdict["pose"]["arms_raised"] is False
    assert "facing" in verdict["pose"]


def test_pose_tier_still_reports_the_keypoint_count(verifier):
    """Node persists keypoints and frame_pipeline logs it — must not change."""
    verifier._pose = FakePose(standing_skeleton())

    verdict = verifier.verify_detailed(roi(), yolo_score=0.65)

    assert verdict["tier"] == "pose"
    # 5 face landmarks + 4 shoulder/wrist + 4 hip/ankle pairs in this skeleton.
    assert verdict["keypoints"] == 13
    assert verdict["pose"]["keypoints"] == 13


def test_a_crouching_person_is_measured_not_guessed(verifier):
    verifier._pose = FakePose(
        standing_skeleton(shoulder_y=0.40, hip_y=0.78, ankle_y=0.95, wrist_y=0.60)
    )

    verdict = verifier.verify_detailed(roi(), yolo_score=0.65)

    assert verdict["pose"]["stance"] == "crouching"


def test_raised_arms_are_reported(verifier):
    verifier._pose = FakePose(standing_skeleton(wrist_y=0.18))

    verdict = verifier.verify_detailed(roi(), yolo_score=0.65)

    assert verdict["pose"]["arms_raised"] is True


def test_pose_present_even_when_evidence_is_the_score_floor_tier(verifier):
    """A weak-evidence track still ran pose, so the measurements are real and
    must reach the enrichment layer rather than being thrown away."""
    verifier._pose = FakePose([])  # pose found nothing usable

    verdict = verifier.verify_detailed(roi(), yolo_score=0.57)

    assert verdict["tier"] == "score_floor"
    assert verdict["pose"]["stance"] == "unknown"
    assert verdict["pose"]["keypoints"] == 0


def test_no_age_is_reported_anywhere_in_the_verdict(verifier):
    verifier._pose = FakePose(standing_skeleton())

    verdict = verifier.verify_detailed(roi(), yolo_score=0.65)

    assert "estimatedAge" not in str(verdict)


def test_verdict_stays_json_serialisable_with_pose(verifier):
    import json

    verifier._pose = FakePose(standing_skeleton())

    json.dumps(verifier.verify_detailed(roi(), yolo_score=0.65))


def test_verdict_shape_is_unchanged_for_existing_consumers(verifier):
    verifier._pose = FakePose(standing_skeleton())

    verdict = verifier.verify_detailed(roi(), yolo_score=0.65)

    assert set(verdict) >= {
        "verified", "tier", "keypoints", "face_detected",
        "yolo_score", "roi_w", "roi_h", "elapsed_ms", "pose",
    }