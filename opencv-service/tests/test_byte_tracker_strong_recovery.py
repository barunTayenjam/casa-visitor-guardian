#!/usr/bin/env python3
"""
Tracker recovery for high-confidence detections.

ByteTrack's second association round exists so a track that missed a frame can
re-attach to its own object instead of spawning a duplicate id. In production
the round only considered *low*-confidence detections, so any track demoted to
'lost' became permanently unreachable: the next solid detection minted a new
track_id while the lost one lingered. One object therefore produced two live
tracks per sighting and `tracklet_len` never climbed past 2, which silently
disabled the frame_pipeline's PERSON_MIN_TRACK_HITS persistence gate.

Uses the production tracker settings from frame_pipeline.py.
"""

from rtsp_ingestion.byte_tracker import ByteTracker

TRACKER_KWARGS = dict(track_thresh=0.25, match_thresh=0.8, track_buffer=30, frame_rate=4)


def det(x, score=0.6, w=60.0, h=120.0, cls="person"):
    return {"bbox": [x, 150.0, w, h], "score": score, "class": cls, "class_id": 0}


def live(results):
    return [r for r in results if r.get("event") != "track_ended"]


def test_strong_detection_recovers_its_own_lost_track():
    """One missed frame must not orphan the track: the next strong detection
    re-attaches to the same id instead of starting a new one."""
    tracker = ByteTracker(**TRACKER_KWARGS)
    first = tracker.update([det(100)])
    assert len(live(first)) == 1
    track_id = live(first)[0]["track_id"]

    tracker.update([])  # one missed frame -> track demoted to 'lost'

    after = tracker.update([det(100)])
    started = [r["track_id"] for r in after if r.get("event") == "track_started"]
    assert started == [], f"duplicate track started after a single missed frame: {after}"
    assert track_id in {r["track_id"] for r in live(after)}, (
        f"original track id {track_id} lost across one missed frame: {after}"
    )


def test_one_object_never_yields_two_live_tracks():
    """Intermittent sightings of a single object must resolve to one track.
    Previously each sighting emitted both the lingering lost track and a fresh
    new one, doubling the event rows written for the same object."""
    tracker = ByteTracker(**TRACKER_KWARGS)
    for tick in range(12):
        results = tracker.update([det(100)] if tick % 3 == 0 else [])
        assert len(live(results)) <= 1, (
            f"tick {tick}: one object produced {len(live(results))} live tracks: {results}"
        )


def test_tracklet_len_grows_for_a_continuously_visible_object():
    """The persistence gate is useless unless tracklet_len climbs. A person
    walking steadily across frame must accumulate length on a single id."""
    tracker = ByteTracker(**TRACKER_KWARGS)
    ids, max_len = set(), 0
    for tick in range(12):
        for r in live(tracker.update([det(100 + tick * 15)])):
            ids.add(r["track_id"])
            max_len = max(max_len, r["tracklet_len"])

    assert len(ids) == 1, f"a steadily visible object churned ids: {sorted(ids)}"
    assert max_len >= 8, f"tracklet_len stalled at {max_len}; persistence gate can never pass"


def test_distinct_objects_keep_distinct_tracks():
    """Recovery must not collapse two people into one track."""
    tracker = ByteTracker(**TRACKER_KWARGS)
    tracker.update([det(50), det(400)])
    tracker.update([])
    after = live(tracker.update([det(50), det(400)]))
    assert len(after) == 2, f"recovery merged two separate objects: {after}"
