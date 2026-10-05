#!/usr/bin/env python3
"""
The persistence gate is the precision control, and it was dead.

Live symptom: the events page filled with snapshots of parked vehicles and empty
courtyards, persisted as event_type='person'. Two independent causes:

  1. ByteTrack's second association round only considered low-confidence
     detections, so any track demoted to 'lost' became permanently unreachable.
     The next solid detection minted a new track_id while the lost one lingered.
     One object produced two live tracks per sighting and tracklet_len never
     climbed past 2.
  2. .env set PERSON_MIN_TRACK_HITS=1, so the gate passed on the very first
     frame even if tracking had been perfect.

With both fixed, an intermittent false positive (seen once, then gone for
minutes) can never accumulate N hits and is dropped before a snapshot file or an
event row exists — while a person who stays in view is kept.
"""

import numpy as np
import pytest

from rtsp_ingestion.byte_tracker import ByteTracker
from rtsp_ingestion.frame_pipeline import FramePipeline


TRACKER_KWARGS = dict(track_thresh=0.25, match_thresh=0.8, track_buffer=30, frame_rate=4)


class AlwaysVerified:
    """Stands in for HumanVerifier so these tests exercise the gate, not the
    models. Every track is 'verified' — which is exactly the live state."""

    def verify_detailed(self, roi, yolo_score):
        return {
            "verified": True, "tier": "score_floor", "keypoints": 0,
            "face_detected": False, "yolo_score": round(float(yolo_score), 4),
            "roi_w": int(roi.shape[1]), "roi_h": int(roi.shape[0]), "elapsed_ms": 0,
        }


class StubVerifierFactory:
    def __call__(self):
        return AlwaysVerified()


def make_pipeline(min_hits=3, min_conf=0.55):
    p = object.__new__(FramePipeline)
    p._camera_id = "cam_test"
    p._frame_counter = 0
    p._verify_cache = {}
    p._snapshotted_tracks = set()
    p._snapshot_paths = {}
    p._snapshot_dims = {}
    p._person_attrs_cache = {}
    p._identity_cache = type("C", (), {"invalidate": lambda *a: None})()
    p._person_min_hits = min_hits
    p._person_min_conf = min_conf
    p._face_recognition_fn = None
    p._get_human_verifier = StubVerifierFactory()
    p._grab_fullres_frame = lambda: None
    p.saved_snapshots = []
    p._save_snapshot = lambda tid, frame, fullres_frame=None: (
        p.saved_snapshots.append(tid) or f"/tmp/snap_t{tid}.jpg"
    )
    p._queue_pipeline_log = lambda *a, **k: None
    return p


def person_det(x, score=0.6):
    return {"bbox": [x, 150.0, 60.0, 120.0], "score": score, "class": "person", "class_id": 0}


def frame():
    return np.full((360, 640, 3), 128, dtype=np.uint8)


def feed(pipeline, tracker, detections):
    return pipeline._enrich_with_identity(tracker.update(detections), frame())


def test_intermittent_false_positive_never_reaches_the_gate():
    """The cam2 jeep/motorcycle ghost: one blob per sighting, minutes apart.
    Every sighting is a brand new tracklet of length 1.

    Python still *reports* the track — it is the persistence layer in Node that
    decides whether an event exists — but it must write no snapshot and attach
    no file_path, so nothing downstream can treat it as a real detection.
    """
    pipeline = make_pipeline(min_hits=3)
    tracker = ByteTracker(**TRACKER_KWARGS)

    reported = []
    for sighting in range(6):
        for gap in range(10):
            feed(pipeline, tracker, [])
        reported += feed(pipeline, tracker, [person_det(44)])

    assert pipeline.saved_snapshots == [], (
        f"ghosts wrote {len(pipeline.saved_snapshots)} snapshots: {pipeline.saved_snapshots}"
    )
    assert pipeline._snapshot_paths == {}, "a ghost track was given a file_path"
    assert all(ev["tracklet_len"] < 3 for ev in reported), (
        f"a ghost tracklet reached the persistence gate: {reported}"
    )
    assert all("file_path" not in ev for ev in reported), (
        "a ghost event carried a file_path to the persistence layer"
    )


def test_person_who_stays_in_view_is_persisted_once():
    """A real walker must still get exactly one event and one snapshot."""
    pipeline = make_pipeline(min_hits=3)
    tracker = ByteTracker(**TRACKER_KWARGS)

    for tick in range(12):
        feed(pipeline, tracker, [person_det(100 + tick * 12, score=0.8)])

    assert len(pipeline.saved_snapshots) == 1, (
        f"expected one snapshot for a persistent person, got {pipeline.saved_snapshots}"
    )
    assert len(pipeline._snapshot_paths) == 1


def test_a_single_detection_event_produces_one_event_not_two():
    """The duplicate-event flood: one object used to emit the lingering lost
    track *and* a fresh new track on the same sighting."""
    pipeline = make_pipeline(min_hits=1)
    tracker = ByteTracker(**TRACKER_KWARGS)

    counts = []
    for tick in range(9):
        events = feed(pipeline, tracker, [person_det(100)] if tick % 3 == 0 else [])
        counts.append(len(events))

    assert max(counts) <= 1, (
        f"one object produced multiple events on a single sighting: {counts}"
    )


def test_confidence_gate_still_applies():
    """min_hits must not become a backdoor around min_conf."""
    pipeline = make_pipeline(min_hits=1, min_conf=0.75)
    tracker = ByteTracker(**TRACKER_KWARGS)

    feed(pipeline, tracker, [person_det(100, score=0.6)])
    assert pipeline.saved_snapshots == [], "a 0.6 detection passed a 0.75 confidence gate"
