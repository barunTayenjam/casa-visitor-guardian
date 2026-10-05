"""Bounding boxes must be stored in the coordinate space of the image they annotate.

Live symptom: every detection box on the events page drew in the top-left
quartile of the snapshot, at roughly a quarter of its real size.

Cause: YOLO runs on the go2rtc `_low` transcode, which `go2rtc.yaml` pins to
`scale=640:360`, while the event snapshot is written from the full-res grab
(2560x1440 on cam2, 2304x1296 on cam1). The persisted bbox stayed in detect
frame pixels, but `EventDetailPanel` scales by rendered/natural where natural is
the full-res image — so a box at detect (472, 80) landed at 1/4 of where it
belongs.

The fix happens at the source: the pipeline knows both the frame it detected
on and the image it just wrote, so it converts before publishing. Anything that
stores coordinates next to a file must speak that file's coordinate space.
"""

import pytest

from bbox_coords import scale_bbox_to_image


class TestScaleBboxToImage:
    def test_scales_detect_frame_to_4k_snapshot(self):
        # cam2: detect 640x360 -> snapshot 2560x1440 (exactly 4x).
        assert scale_bbox_to_image([472.5, 80, 54.9, 134.1], (640, 360), (2560, 1440)) == [
            1890.0,
            320.0,
            219.6,
            536.4,
        ]

    def test_scales_detect_frame_to_cam1_snapshot(self):
        # cam1: detect 640x360 -> snapshot 2304x1296 (3.6x on both axes).
        box = scale_bbox_to_image([160, 90, 64, 180], (640, 360), (2304, 1296))
        assert box == pytest.approx([576.0, 324.0, 230.4, 648.0])

    def test_identity_when_source_and_image_match(self):
        assert scale_bbox_to_image([10, 20, 30, 40], (640, 360), (640, 360)) == [
            10.0,
            20.0,
            30.0,
            40.0,
        ]

    def test_box_never_leaves_the_image(self):
        x, y, w, h = scale_bbox_to_image([639, 359, 1, 1], (640, 360), (2560, 1440))
        assert x + w <= 2560
        assert y + h <= 1440

    def test_empty_bbox_stays_empty(self):
        # ByteTracker emits bbox: [] for track_ended — no frame to scale into.
        assert scale_bbox_to_image([], (640, 360), (2560, 1440)) == []

    def test_malformed_bbox_is_returned_untouched(self):
        assert scale_bbox_to_image([10, 20], (640, 360), (2560, 1440)) == [10, 20]

    def test_unknown_source_size_leaves_bbox_alone(self):
        # A missing/zero source size means we cannot know the mapping; scaling
        # blindly would silently shift every box, so refuse instead.
        assert scale_bbox_to_image([10, 20, 30, 40], (0, 0), (2560, 1440)) == [
            10.0,
            20.0,
            30.0,
            40.0,
        ]

    def test_unknown_image_size_leaves_bbox_alone(self):
        assert scale_bbox_to_image([10, 20, 30, 40], (640, 360), (0, 0)) == [
            10.0,
            20.0,
            30.0,
            40.0,
        ]

    def test_returns_new_list_not_a_mutation(self):
        original = [100, 100, 50, 50]
        scaled = scale_bbox_to_image(original, (640, 360), (2560, 1440))
        assert original == [100, 100, 50, 50]
        assert scaled is not original


class TestAlignEventBbox:
    """The publish-time wiring, without needing a FramePipeline instance."""

    def test_event_with_snapshot_is_aligned(self):
        from bbox_coords import align_event_bbox

        ev = {"track_id": 7, "bbox": [472.5, 80, 54.9, 134.1], "file_path": "/x/a.jpg"}
        align_event_bbox(ev, (640, 360), {7: (2560, 1440)})

        assert ev["bbox"] == [1890.0, 320.0, 219.6, 536.4]

    def test_event_without_snapshot_keeps_detect_coords(self):
        from bbox_coords import align_event_bbox

        ev = {"track_id": 7, "bbox": [10, 20, 30, 40]}
        align_event_bbox(ev, (640, 360), {7: (2560, 1440)})

        assert ev["bbox"] == [10, 20, 30, 40]

    def test_snapshot_dims_unknown_keeps_detect_coords(self):
        # Dimensions are recorded in the same call that writes the file, so a
        # track without recorded dims has no trustworthy target space.
        from bbox_coords import align_event_bbox

        ev = {"track_id": 9, "bbox": [10, 20, 30, 40], "file_path": "/x/b.jpg"}
        align_event_bbox(ev, (640, 360), {})

        assert ev["bbox"] == [10, 20, 30, 40]

    def test_does_not_double_scale_on_repeat_publish(self):
        # The tracker re-emits every frame; a second pass must not scale again.
        from bbox_coords import align_event_bbox

        ev = {"track_id": 7, "bbox": [100, 100, 50, 50], "file_path": "/x/a.jpg"}
        align_event_bbox(ev, (640, 360), {7: (2560, 1440)})
        once = list(ev["bbox"])
        align_event_bbox(ev, (640, 360), {7: (2560, 1440)})

        assert ev["bbox"] == once
