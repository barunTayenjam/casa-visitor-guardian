#!/usr/bin/env python3
"""
ByteTrack — Multi-Object Tracking by Associating Every Detection Box.

Lightweight, numpy-only implementation designed for the SentryVision edge
detection pipeline. No external tracking dependencies.

Based on: ByteTrack (Pang et al., ECCV 2022)
"""

import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
import time
import itertools


class KalmanBoxTracker:
    """Kalman filter for a single bounding box track.
    
    State vector: [cx, cy, w, h, vcx, vcy, vw, vh]  (8-dim)
    Measurement:  [cx, cy, w, h]                       (4-dim)
    """

    _motion_mat = None
    _update_mat = None

    @classmethod
    def _init_matrices(cls):
        if cls._motion_mat is not None:
            return
        ndim, dt = 4, 1.0
        cls._motion_mat = np.eye(2 * ndim, 2 * ndim)
        for i in range(ndim):
            cls._motion_mat[i, ndim + i] = dt
        cls._update_mat = np.eye(ndim, 2 * ndim)

    def __init__(self, tlwh: np.ndarray):
        KalmanBoxTracker._init_matrices()
        self.mean = np.zeros(8, dtype=np.float64)
        self.mean[:4] = tlwh.astype(np.float64)
        self.covariance = np.eye(8, dtype=np.float64) * 10.0
        self.covariance[:4, :4] *= self.mean[3]
        self.covariance[4:, 4:] *= self.mean[3] * 0.01

    def predict(self):
        std_pos = [
            0.05 * self.mean[3],
            0.05 * self.mean[3],
            0.01 * self.mean[2],
            0.01 * self.mean[3],
        ]
        std_vel = [
            0.0625 * self.mean[3],
            0.0625 * self.mean[3],
            0.0125 * self.mean[2],
            0.0125 * self.mean[3],
        ]
        motion_cov = np.diag(np.square(np.r_[std_pos, std_vel]).astype(np.float64))
        self.mean = self._motion_mat @ self.mean
        self.covariance = self._motion_mat @ self.covariance @ self._motion_mat.T + motion_cov
        return self.mean[:4].copy()

    def update(self, measurement: np.ndarray):
        projected_mean = self._update_mat @ self.mean
        projected_cov = self._update_mat @ self.covariance @ self._update_mat.T
        std = [
            0.05 * self.mean[3],
            0.05 * self.mean[3],
            0.01 * self.mean[2],
            0.01 * self.mean[3],
        ]
        innovation_cov = np.diag(np.square(std).astype(np.float64))
        S = projected_cov + innovation_cov
        try:
            K = self.covariance @ self._update_mat.T @ np.linalg.inv(S)
        except np.linalg.LinAlgError:
            K = self.covariance @ self._update_mat.T @ np.linalg.pinv(S)
        innovation = measurement.astype(np.float64) - projected_mean
        self.mean = self.mean + K @ innovation
        self.covariance = (np.eye(8) - K @ self._update_mat) @ self.covariance

    def get_state(self) -> np.ndarray:
        return self.mean[:4].copy()


def _tlwh_to_xyah(tlwh: np.ndarray) -> np.ndarray:
    out = tlwh.copy().astype(np.float64)
    out[0] += out[2] / 2
    out[1] += out[3] / 2
    return out


def _xyah_to_tlwh(xyah: np.ndarray) -> np.ndarray:
    out = xyah.copy().astype(np.float64)
    out[0] -= out[2] / 2
    out[1] -= out[3] / 2
    return out


def _bbox_iou(box_a: np.ndarray, box_b: np.ndarray) -> float:
    a = _tlwh_to_tlbr(box_a)
    b = _tlwh_to_tlbr(box_b)
    ix1 = max(a[0], b[0])
    iy1 = max(a[1], b[1])
    ix2 = min(a[2], b[2])
    iy2 = min(a[3], b[3])
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    area_a = max(0, a[2] - a[0]) * max(0, a[3] - a[1])
    area_b = max(0, b[2] - b[0]) * max(0, b[3] - b[1])
    union = area_a + area_b - inter
    if union <= 0:
        return 0.0
    return float(inter / union)


def _tlwh_to_tlbr(tlwh: np.ndarray) -> np.ndarray:
    ret = tlwh.copy().astype(np.float64)
    ret[2] += ret[0]
    ret[3] += ret[1]
    return ret


def _iou_cost_matrix(
    dets: List[np.ndarray], tracks: List[np.ndarray]
) -> np.ndarray:
    if not dets or not tracks:
        return np.empty((0, 0), dtype=np.float64)
    M, N = len(dets), len(tracks)
    cost = np.zeros((M, N), dtype=np.float64)
    for i in range(M):
        for j in range(N):
            cost[i, j] = 1.0 - _bbox_iou(dets[i], tracks[j])
    return cost


def _linear_assignment(cost: np.ndarray, thresh: float):
    """Greedy nearest-neighbor assignment (no scipy dependency)."""
    if cost.size == 0:
        return np.empty((0, 2), dtype=int), np.array([], dtype=int), np.array([], dtype=int)
    matched = []
    used_rows = set()
    used_cols = set()
    for _ in range(min(cost.shape[0], cost.shape[1])):
        idx = np.argmin(cost)
        r, c = np.unravel_index(idx, cost.shape)
        if cost[r, c] > thresh:
            break
        if r not in used_rows and c not in used_cols:
            matched.append([r, c])
            used_rows.add(r)
            used_cols.add(c)
        cost[r, c] = float("inf")
    matched = np.array(matched, dtype=int) if matched else np.empty((0, 2), dtype=int)
    unmatched_rows = np.array([i for i in range(cost.shape[0]) if i not in used_rows], dtype=int)
    unmatched_cols = np.array([j for j in range(cost.shape[1]) if j not in used_cols], dtype=int)
    return matched, unmatched_rows, unmatched_cols


class Track:
    """Single tracked object with lifecycle state."""

    _next_id = 1

    def __init__(self, detection: Dict[str, Any], frame_id: int):
        self.track_id = Track._next_id
        Track._next_id += 1
        self.class_name: str = detection.get("class", "unknown")
        self.class_id: int = detection.get("class_id", 0)
        self.score: float = detection.get("score", 0.0)
        self.bbox: np.ndarray = np.array(detection["bbox"], dtype=np.float64)
        self.state: str = "new"
        self.frame_id = frame_id
        self.start_frame = frame_id
        self.last_matched_frame = frame_id
        self.tracklet_len = 1
        self.kalman = KalmanBoxTracker(self.bbox.copy())
        self.identity: Optional[str] = None
        self.identity_confidence: float = 0.0
        self.identity_timestamp: float = 0.0

    def predict(self) -> np.ndarray:
        return self.kalman.predict()

    def update(self, detection: Dict[str, Any], frame_id: int):
        self.score = detection.get("score", self.score)
        meas = np.array(detection["bbox"], dtype=np.float64)
        self.kalman.update(meas)
        self.bbox = self.kalman.get_state()
        self.frame_id = frame_id
        self.last_matched_frame = frame_id
        self.tracklet_len += 1
        if self.state == "new":
            self.state = "tracked"
        elif self.state == "lost":
            self.state = "tracked"

    def mark_lost(self, frame_id: int):
        self.state = "lost"
        self.frame_id = frame_id

    def mark_removed(self):
        self.state = "removed"

    def is_active(self) -> bool:
        return self.state in ("new", "tracked", "lost")


class ByteTracker:
    """ByteTrack multi-object tracker.

    Implements the two-round association strategy:
      1. High-confidence detections matched to tracked tracks.
      2. Low-confidence detections matched to remaining tracks (byte association).

    Args:
        track_thresh: minimum score for a detection to be "high confidence".
        match_thresh: IoU distance threshold for data association.
        track_buffer: number of frames to keep a lost track before removing.
        frame_rate:   video FPS (used to compute max_lost frames).
    """

    def __init__(
        self,
        track_thresh: float = 0.25,
        match_thresh: float = 0.8,
        track_buffer: int = 30,
        frame_rate: int = 30,
    ):
        self.track_thresh = track_thresh
        self.match_thresh = match_thresh
        self.track_buffer = track_buffer
        self.frame_rate = frame_rate
        self.max_time_lost = int(frame_rate / 30.0 * track_buffer)

        self.tracks: List[Track] = []
        self.frame_id = 0
        self._prev_track_ids: set = set()

    def update(
        self, detections: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Process one frame of detections and return live tracked objects.

        Each detection dict must have:
          - "bbox": [x, y, w, h] (top-left format)
          - "score": float 0-1
          - "class": str
          - "class_id": int

        Returns list of dicts with added "track_id" and "track_state".
        """
        self.frame_id += 1
        frame_id = self.frame_id

        # --- Partition detections ---
        dets_high = [d for d in detections if d["score"] >= self.track_thresh]
        dets_low = [d for d in detections if d["score"] < self.track_thresh]

        # --- Predict all existing tracks ---
        predicted_boxes = []
        for t in self.tracks:
            predicted_boxes.append(t.predict())

        # --- Partition existing tracks ---
        tracked = [t for t in self.tracks if t.state in ("tracked", "new")]
        lost = [t for t in self.tracks if t.state == "lost"]

        # --- Round 1: high-confidence detections vs tracked tracks ---
        det_boxes_h = [np.array(d["bbox"], dtype=np.float64) for d in dets_high]
        trk_boxes_t = [t.bbox.copy() for t in tracked]

        cost1 = _iou_cost_matrix(det_boxes_h, trk_boxes_t)
        matches1, unmatched_dets_h, unmatched_trks_t = _linear_assignment(
            cost1, self.match_thresh
        )

        for row, col in matches1:
            tracked[col].update(dets_high[row], frame_id)

        for idx in unmatched_trks_t:
            tracked[idx].mark_lost(frame_id)

        # Remaining tracked tracks after round 1
        remaining_tracks = [tracked[i] for i in unmatched_trks_t]
        remaining_tracks.extend(lost)

        # --- Round 2: low-confidence detections vs remaining tracks ---
        det_boxes_l = [np.array(d["bbox"], dtype=np.float64) for d in dets_low]
        trk_boxes_r = [t.bbox.copy() for t in remaining_tracks]

        cost2 = _iou_cost_matrix(det_boxes_l, trk_boxes_r)
        matches2, _, unmatched_trks_r = _linear_assignment(
            cost2, self.match_thresh
        )

        rem_indices = list(unmatched_trks_t) + list(range(len(lost)))
        for row, col in matches2:
            actual_idx = rem_indices[col] if col < len(rem_indices) else col
            if actual_idx < len(self.tracks):
                self.tracks[actual_idx].mark_lost(frame_id)

        # Unmatched low detections are discarded (no new tracks from low conf)

        # --- Remove stale lost tracks ---
        for t in self.tracks:
            if t.state == "lost" and (frame_id - t.last_matched_frame) > self.max_time_lost:
                t.mark_removed()

        # --- Create new tracks from unmatched high-confidence detections ---
        current_track_ids = {t.track_id for t in self.tracks if t.is_active()}
        for idx in unmatched_dets_h:
            new_track = Track(dets_high[idx], frame_id)
            self.tracks.append(new_track)
            current_track_ids.add(new_track.track_id)

        # --- Determine lifecycle events ---
        new_ids = current_track_ids - self._prev_track_ids
        ended_ids = self._prev_track_ids - current_track_ids
        self._prev_track_ids = current_track_ids

        # --- Purge removed tracks ---
        self.tracks = [t for t in self.tracks if t.state != "removed"]

        # --- Build output ---
        results = []
        for t in self.tracks:
            if not t.is_active():
                continue
            event_type = "track_updated"
            if t.track_id in new_ids:
                event_type = "track_started"
            results.append(
                {
                    "track_id": t.track_id,
                    "bbox": [round(float(v), 1) for v in t.kalman.get_state()],
                    "score": round(t.score, 4),
                    "class": t.class_name,
                    "class_id": t.class_id,
                    "track_state": t.state,
                    "event": event_type,
                    "tracklet_len": t.tracklet_len,
                    "identity": t.identity,
                    "identity_confidence": t.identity_confidence,
                }
            )

        # Append ended events (track_left)
        for tid in ended_ids:
            results.append(
                {
                    "track_id": tid,
                    "event": "track_ended",
                    "bbox": [],
                    "score": 0.0,
                    "class": "",
                    "class_id": 0,
                }
            )

        return results
