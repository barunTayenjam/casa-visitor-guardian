#!/usr/bin/env python3
"""
Pose semantics from MediaPipe landmarks.

`person_verifier.py` already runs MediaPipe Pose on every person track and
throws away everything except a visibility count:

    n = sum(1 for lm in results.pose_landmarks.landmark if lm.visibility > 0.2)

Thirty-three landmarks carrying position, depth and visibility are discarded,
and `person_analyzer.py` then guesses at clothing, facing, stance and
"estimatedAge" from Haar cascades and bbox geometry. The guesses are wrong in
ways that matter:

    bodyLanguage: "suspicious"   on someone standing still at distance
    actions: ["side_view_or_crouching"]   for a person simply walking past
    estimatedAge: "adult (far range)"     derived from distance, not age

This module turns landmarks into measurements instead. It is deliberately pure:
no model loading, no I/O, no cv2 — so every rule is testable with a synthetic
skeleton.

Only genuinely single-frame-measurable facts are reported. Walking vs standing
needs a time series, and front vs back is ambiguous in one frame, so neither is
invented here; the module reports what it can measure and "unknown" otherwise.
"""

import pytest

from pose_features import describe_pose

NOSE = 0
L_EYE = 2
R_EYE = 5
L_EAR = 7
R_EAR = 8
L_SHOULDER = 11
R_SHOULDER = 12
L_ELBOW = 13
R_ELBOW = 14
L_WRIST = 15
R_WRIST = 16
L_HIP = 23
R_HIP = 24
L_KNEE = 25
R_KNEE = 26
L_ANKLE = 27
R_ANKLE = 28

VIS = 0.95
HIDDEN = 0.05


class Landmark:
    __slots__ = ("x", "y", "z", "visibility")

    def __init__(self, x, y, z=0.0, visibility=VIS):
        self.x = x
        self.y = y
        self.z = z
        self.visibility = visibility


def skeleton(
    shoulder_y=0.30,
    hip_y=0.55,
    knee_y=0.75,
    ankle_y=0.95,
    shoulder_w=0.16,
    wrist_y=0.45,
    shoulder_z_asym=0.0,
    face_visibility=VIS,
    body_visibility=VIS,
):
    """A 33-landmark skeleton, normalised 0..1 like MediaPipe output."""
    lm = [Landmark(0.5, 0.5, visibility=0.0) for _ in range(33)]
    mid_x = 0.5

    lm[NOSE] = Landmark(mid_x, shoulder_y - 0.10, visibility=face_visibility)
    lm[L_EYE] = Landmark(mid_x - 0.01, shoulder_y - 0.11, visibility=face_visibility)
    lm[R_EYE] = Landmark(mid_x + 0.01, shoulder_y - 0.11, visibility=face_visibility)
    lm[L_EAR] = Landmark(mid_x - 0.03, shoulder_y - 0.10, visibility=face_visibility)
    lm[R_EAR] = Landmark(mid_x + 0.03, shoulder_y - 0.10, visibility=face_visibility)

    lm[L_SHOULDER] = Landmark(mid_x - shoulder_w / 2, shoulder_y, z=-shoulder_z_asym,
                              visibility=body_visibility)
    lm[R_SHOULDER] = Landmark(mid_x + shoulder_w / 2, shoulder_y, z=shoulder_z_asym,
                              visibility=body_visibility)
    lm[L_ELBOW] = Landmark(mid_x - shoulder_w / 2, (shoulder_y + wrist_y) / 2,
                           visibility=body_visibility)
    lm[R_ELBOW] = Landmark(mid_x + shoulder_w / 2, (shoulder_y + wrist_y) / 2,
                           visibility=body_visibility)
    lm[L_WRIST] = Landmark(mid_x - shoulder_w / 2, wrist_y, visibility=body_visibility)
    lm[R_WRIST] = Landmark(mid_x + shoulder_w / 2, wrist_y, visibility=body_visibility)

    lm[L_HIP] = Landmark(mid_x - 0.05, hip_y, visibility=body_visibility)
    lm[R_HIP] = Landmark(mid_x + 0.05, hip_y, visibility=body_visibility)
    lm[L_KNEE] = Landmark(mid_x - 0.05, knee_y, visibility=body_visibility)
    lm[R_KNEE] = Landmark(mid_x + 0.05, knee_y, visibility=body_visibility)
    lm[L_ANKLE] = Landmark(mid_x - 0.05, ankle_y, visibility=body_visibility)
    lm[R_ANKLE] = Landmark(mid_x + 0.05, ankle_y, visibility=body_visibility)
    return lm


class TestStance:
    def test_upright_figure_is_standing(self):
        result = describe_pose(skeleton())

        assert result["stance"] == "standing"

    def test_deep_crouch_is_detected_as_crouching(self):
        # Hips drop to just above the knees, knees fold under the body.
        result = describe_pose(skeleton(shoulder_y=0.40, hip_y=0.78, knee_y=0.82, ankle_y=0.95))

        assert result["stance"] == "crouching"

    def test_a_person_bending_to_pick_something_up_is_not_crouching(self):
        # Hips stay high, only the torso tips forward.
        result = describe_pose(skeleton(shoulder_y=0.34, hip_y=0.56, knee_y=0.76, ankle_y=0.95))

        assert result["stance"] == "standing"

    def test_a_person_sitting_has_folded_legs(self):
        result = describe_pose(skeleton(shoulder_y=0.42, hip_y=0.72, knee_y=0.74, ankle_y=0.78))

        assert result["stance"] in ("sitting", "crouching")

    def test_unknown_when_the_body_cannot_be_located(self):
        result = describe_pose([Landmark(0.5, 0.5, visibility=0.0) for _ in range(33)])

        assert result["stance"] == "unknown"


class TestArms:
    def test_arms_down_at_the_sides(self):
        result = describe_pose(skeleton(wrist_y=0.45))

        assert result["arms_raised"] is False

    def test_hands_above_the_shoulders_count_as_raised(self):
        result = describe_pose(skeleton(wrist_y=0.20))

        assert result["arms_raised"] is True

    def test_one_raised_arm_still_counts(self):
        lm = skeleton(wrist_y=0.45)
        lm[L_WRIST] = Landmark(0.42, 0.18)

        result = describe_pose(lm)

        assert result["arms_raised"] is True


class TestFacing:
    def test_symmetric_shoulders_read_as_front(self):
        result = describe_pose(skeleton(shoulder_z_asym=0.0))

        assert result["facing"] == "front"

    def test_depth_asymmetry_between_shoulders_reads_as_side(self):
        result = describe_pose(skeleton(shoulder_z_asym=0.09))

        assert result["facing"] == "side"

    def test_facing_is_unknown_without_face_landmarks(self):
        lm = skeleton(face_visibility=HIDDEN)

        result = describe_pose(lm)

        assert result["facing"] == "unknown"


class TestDataQuality:
    def test_reports_how_much_of_the_body_was_actually_measurable(self):
        result = describe_pose(skeleton())

        assert result["visible_landmarks"] > 0
        assert 0.0 < result["mean_visibility"] <= 1.0

    def test_torso_lean_is_measured_in_degrees(self):
        assert describe_pose(skeleton())["torso_lean_deg"] == pytest.approx(0.0, abs=2.0)

    def test_a_sideways_lean_is_detected(self):
        lm = skeleton()
        lm[L_SHOULDER].x = 0.62  # torso tipped to the right

        assert describe_pose(lm)["torso_lean_deg"] > 5.0

    def test_keypoint_count_still_reported_for_the_verifier_tier(self):
        # 5 face landmarks + 12 body landmarks in the synthetic skeleton.
        assert describe_pose(skeleton())["keypoints"] == 17

    def test_empty_landmarks_do_not_raise(self):
        result = describe_pose([])

        assert result["stance"] == "unknown"
        assert result["keypoints"] == 0


class TestNoFabrication:
    """Fields the old heuristics invented must not reappear here."""

    def test_no_age_is_inferred(self):
        assert "estimatedAge" not in describe_pose(skeleton())

    def test_no_motion_claim_without_a_time_series(self):
        # walking/stationary cannot be decided from one frame.
        assert "motion" not in describe_pose(skeleton())

    def test_nothing_is_flagged_suspicious_by_pose_alone(self):
        result = describe_pose(skeleton(shoulder_z_asym=0.09))

        assert "bodyLanguage" not in result
        assert "suspicious" not in result.values()