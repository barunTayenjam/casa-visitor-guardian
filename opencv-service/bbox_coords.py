#!/usr/bin/env python3
"""Coordinate-space helpers for persisted bounding boxes.

The detection pipeline and the evidence image live in different coordinate
spaces: YOLO runs on the go2rtc ``_low`` transcode (pinned to 1280x720 by
``go2rtc.yaml``), while the event snapshot is written from the full-res grab
(2560x1440 / 2304x1296). A bbox that is stored next to that file must be
expressed in the file's pixels, otherwise every consumer has to guess which
space it is reading — the events page drew boxes in the top-left quarter of the
image because it assumed image pixels.

Nothing here mutates its input: callers frequently hold the tracker's own dict,
and a box that got scaled in place once would be scaled again on the next frame.
"""

from __future__ import annotations

from typing import List, Sequence, Tuple


def scale_bbox_to_image(
    bbox: Sequence[float],
    source_size: Tuple[int, int],
    image_size: Tuple[int, int],
) -> List[float]:
    """Map a top-left ``[x, y, w, h]`` box from ``source_size`` to ``image_size``.

    Returns a new list. An empty, short, or unscalable input is returned as a
    value copy with no coordinate change — an unknown mapping is never guessed,
    because a wrong guess silently misplaces every box on the page.
    """
    box = [float(v) for v in bbox]
    if len(box) != 4:
        return box

    src_w, src_h = source_size
    dst_w, dst_h = image_size
    if src_w <= 0 or src_h <= 0 or dst_w <= 0 or dst_h <= 0:
        return box

    sx = dst_w / src_w
    sy = dst_h / src_h
    if sx == 1.0 and sy == 1.0:
        return box

    return [box[0] * sx, box[1] * sy, box[2] * sx, box[3] * sy]


def align_event_bbox(
    event: dict,
    detect_size: Tuple[int, int],
    snapshot_size_by_track: dict,
) -> None:
    """Put an event's bbox into the coordinate space of the snapshot it names.

    Called once per publish. Events without a snapshot (or without recorded
    snapshot dimensions) keep detect-frame coordinates: there is no image to
    align them with, and guessing the target space would move the box for no
    reason.

    Idempotent — a second call with the same input is a no-op, so a caller that
    emits an event more than once cannot compound the scale factor.
    """
    if not event.get("file_path") or event.get("_bbox_aligned"):
        return
    size = snapshot_size_by_track.get(event.get("track_id"))
    if not size:
        return
    event["bbox"] = scale_bbox_to_image(event.get("bbox") or [], detect_size, size)
    event["_bbox_aligned"] = True
