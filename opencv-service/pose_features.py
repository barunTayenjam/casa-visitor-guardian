#!/usr/bin/env python3
"""Pose semantics from MediaPipe landmarks.

MediaPipe Pose returns 33 landmarks per person, each carrying normalised x/y,
a depth estimate and a visibility score. `person_verifier.py` reduced them to a
visibility count and discarded the rest, leaving `person_analyzer.py` to guess
stance and facing from Haar cascades and bounding-box geometry. Those guesses
mislabel ordinary people -- `bodyLanguage: "suspicious"` on someone standing at
a distance, `actions: ["side_view_or_crouching"]` on a person walking past.

This module reports what a single frame can actually measure and nothing more:

  stance          standing | sitting | crouching | unknown
  arms_raised     hands above the shoulder line
  facing          front | side | unknown (never guessed from a missing signal)
  torso_lean_deg  signed angle of the hip->shoulder axis from vertical
  data quality    keypoints, visible_landmarks, mean_visibility

Deliberately absent: walking/stationary (needs a time series), front-vs-back
(one frame is ambiguous), age, and any suspicion label. Those were fabricated
before; fabricating them here would just move the fabrication.

Pure module: no model loading, no I/O, no cv2. Every rule is unit-testable with
a synthetic skeleton (see tests/test_pose_features.py).
"""

import math

VISIBILITY_THRESHOLD = 0.2
MIN_KEYPOINTS_FOR_STANCE = 8

# MediaPipe Pose landmark indices.
NOSE = 0
L_EYE, R_EYE = 2, 5
L_EAR, R_EAR = 7, 8
L_SHOULDER, R_SHOULDER = 11, 12
L_WRIST, R_WRIST = 15, 16
L_HIP, R_HIP = 23, 24
L_KNEE, R_KNEE = 25, 26
L_ANKLE, R_ANKLE = 27, 28

FACE_INDICES = (NOSE, L_EYE, R_EYE, L_EAR, R_EAR)

# The hip rises toward the knees as the legs fold. Measured as the hip's
# fraction of the shoulder->ankle span: ~0.38 upright, ~0.69 in a deep crouch,
# ~0.83 seated (the shins fold so the ankle ends up level with the hip).
FOLDED_HIP_FRACTION = 0.47
SEATED_HIP_FRACTION = 0.75

# Depth gap between the shoulders relative to shoulder width. MediaPipe's z is
# in roughly the same units as x, so the ratio is scale-invariant.
SIDE_VIEW_Z_RATIO = 0.35

# Wrists must clear the shoulder line by this margin to count as raised.
ARM_RAISE_MARGIN = 0.02


def _attr(landmark, name):
    if landmark is None:
        return None
    if isinstance(landmark, dict):
        return landmark.get(name)
    return getattr(landmark, name, None)


def _visible(landmark):
    value = _attr(landmark, "visibility")
    if value is None:
        return True
    return float(value) > VISIBILITY_THRESHOLD


def _midpoint(a, b):
    ax, ay = _attr(a, "x"), _attr(a, "y")
    bx, by = _attr(b, "x"), _attr(b, "y")
    if None in (ax, ay, bx, by):
        return None
    return (float(ax) + float(bx)) / 2.0, (float(ay) + float(by)) / 2.0


def _at(landmarks, index):
    if index >= len(landmarks):
        return None
    return landmarks[index]


def _stance(landmarks):
    shoulders = _midpoint(_at(landmarks, L_SHOULDER), _at(landmarks, R_SHOULDER))
    hips = _midpoint(_at(landmarks, L_HIP), _at(landmarks, R_HIP))
    ankles = _midpoint(_at(landmarks, L_ANKLE), _at(landmarks, R_ANKLE))
    if not all((shoulders, hips, ankles)):
        return "unknown"

    shoulder_y = shoulders[1]
    span = ankles[1] - shoulder_y
    if span <= 1e-6:
        return "unknown"

    hip_fraction = (hips[1] - shoulder_y) / span
    if hip_fraction < FOLDED_HIP_FRACTION:
        return "standing"
    if hip_fraction >= SEATED_HIP_FRACTION:
        return "sitting"
    return "crouching"


def _arms_raised(landmarks, shoulder_y):
    if shoulder_y is None:
        return False
    for index in (L_WRIST, R_WRIST):
        wrist = _at(landmarks, index)
        if not _visible(wrist):
            continue
        wrist_y = _attr(wrist, "y")
        if wrist_y is not None and float(wrist_y) < shoulder_y - ARM_RAISE_MARGIN:
            return True
    return False


def _facing(landmarks, shoulder_span):
    if not any(_visible(_at(landmarks, i)) for i in FACE_INDICES):
        return "unknown"

    left, right = _at(landmarks, L_SHOULDER), _at(landmarks, R_SHOULDER)
    lz, rz = _attr(left, "z"), _attr(right, "z")
    if lz is None or rz is None:
        return "unknown"

    width = abs(float(_attr(right, "x")) - float(_attr(left, "x")))
    if width <= 1e-6:
        return "unknown"

    return "side" if abs(float(rz) - float(lz)) / width >= SIDE_VIEW_Z_RATIO else "front"


def _torso_lean_deg(landmarks):
    shoulders = _midpoint(_at(landmarks, L_SHOULDER), _at(landmarks, R_SHOULDER))
    hips = _midpoint(_at(landmarks, L_HIP), _at(landmarks, R_HIP))
    if not shoulders or not hips:
        return 0.0
    dx = shoulders[0] - hips[0]
    dy = hips[1] - shoulders[1]
    if dy <= 1e-6:
        return 0.0
    return math.degrees(math.atan2(dx, dy))


def describe_pose(landmarks):
    """Turn a MediaPipe pose landmark sequence into measured semantics.

    Args:
        landmarks: sequence of objects exposing .x/.y/.z/.visibility, or dicts
            with those keys. May be empty, partial, or contain None entries.

    Returns:
        dict with stance, arms_raised, facing, torso_lean_deg, keypoints,
        visible_landmarks and mean_visibility. Keys are always present; values
        are "unknown"/defaults when the body could not be measured.
    """
    landmarks = list(landmarks or [])

    visible = [lm for lm in landmarks if _visible(lm)]
    keypoints = len(visible)
    mean_visibility = (
        sum(float(_attr(lm, "visibility") or 0.0) for lm in visible) / len(visible)
        if visible
        else 0.0
    )

    shoulders = _midpoint(_at(landmarks, L_SHOULDER), _at(landmarks, R_SHOULDER))
    shoulder_y = shoulders[1] if shoulders else None

    left, right = _at(landmarks, L_SHOULDER), _at(landmarks, R_SHOULDER)
    shoulder_span = None
    if left is not None and right is not None:
        lx, rx = _attr(left, "x"), _attr(right, "x")
        if lx is not None and rx is not None:
            shoulder_span = abs(float(rx) - float(lx))

    stance = _stance(landmarks) if keypoints >= MIN_KEYPOINTS_FOR_STANCE else "unknown"

    return {
        "stance": stance,
        "arms_raised": _arms_raised(landmarks, shoulder_y),
        "facing": _facing(landmarks, shoulder_span),
        "torso_lean_deg": round(_torso_lean_deg(landmarks), 1),
        "keypoints": keypoints,
        "visible_landmarks": keypoints,
        "mean_visibility": round(mean_visibility, 3),
    }