#!/usr/bin/env python3
"""
Per-camera frame processing pipeline.

Connects the FFmpegReader (thread-based) → MotionGate (MOG2) →
frame queues → WebSocketPublisher (async).

Architecture for a single camera:

    FFmpegReader thread
         │  raw BGR24 frame
         ▼
    MotionGate (MOG2) ─── no motion ──→ live queue (always, if subscribed)
         │  motion detected
         ▼
    motion queue ──→ (future: YOLO + tracking)

The pipeline thread is independent of the WebSocket asyncio loop.
Frame data crosses the thread boundary via thread-safe DropOldestQueue.

Usage:
    pipeline = FramePipeline(camera_config, publisher)
    pipeline.start()
    # ...
    pipeline.stop()
"""

import time
import cv2
import numpy as np
from typing import Optional

from .config import (
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    DEFAULT_FPS,
    MOG2_HISTORY,
    MOG2_VAR_THRESHOLD,
    MOTION_PIXEL_THRESHOLD,
    JPEG_QUALITY,
)
from .queues import DropOldestQueue, DropIfFullQueue
from .ffmpeg_reader import FFmpegReader
from .websocket_publisher import WebSocketPublisher


class MotionGate:
    """Per-camera MOG2 background subtractor for motion gating.

    Thread-safe as long as detect() is called from a single thread
    (which it is — the FFmpegReader callback thread).
    """

    def __init__(
        self,
        camera_id: str,
        history: int = MOG2_HISTORY,
        var_threshold: int = MOG2_VAR_THRESHOLD,
        pixel_threshold: int = MOTION_PIXEL_THRESHOLD,
    ):
        self.camera_id = camera_id
        self._bg_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=history,
            varThreshold=var_threshold,
            detectShadows=False,
        )
        self._pixel_threshold = pixel_threshold
        self._frame_count = 0
        self._warmup_frames = 10

    def detect(self, frame: np.ndarray) -> dict:
        """Run MOG2 on a frame and return motion metadata.

        Returns:
            dict with keys:
                motion_detected (bool)
                motion_pixels   (int)
                confidence      (float)  0-100
        """
        self._frame_count += 1

        fg_mask = self._bg_subtractor.apply(frame)
        _, fg_mask = cv2.threshold(fg_mask, 250, 255, cv2.THRESH_BINARY)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel, iterations=1)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel, iterations=1)

        motion_pixels = cv2.countNonZero(fg_mask)
        total_pixels = fg_mask.shape[0] * fg_mask.shape[1]
        motion_percentage = (motion_pixels / total_pixels) * 100

        # During warmup, always report no motion (background model is settling)
        if self._frame_count < self._warmup_frames:
            return {
                'motion_detected': False,
                'motion_pixels': motion_pixels,
                'confidence': 0.0,
            }

        motion_detected = motion_pixels > self._pixel_threshold
        confidence = min(100.0, motion_percentage * 10)

        return {
            'motion_detected': motion_detected,
            'motion_pixels': motion_pixels,
            'confidence': round(confidence, 2),
        }


class FramePipeline:
    """Per-camera pipeline: FFmpegReader → MotionGate → queues → WebSocket.

    Usage:
        pipeline = FramePipeline(camera_config, publisher)
        pipeline.start()
        # ...
        pipeline.stop()
    """

    def __init__(
        self,
        camera_config: dict,
        publisher: WebSocketPublisher,
        frame_skip: int = 1,
    ):
        self._config = camera_config
        self._publisher = publisher
        self._frame_skip = frame_skip
        self._frame_counter = 0

        self._camera_id: str = camera_config['id']
        stream = self._get_primary_stream()

        # Per-camera queues
        self._live_queue: DropOldestQueue = publisher.add_frame_queue(self._camera_id)
        self._motion_queue = DropIfFullQueue(5)

        # MOG2 motion gate
        self._motion_gate = MotionGate(
            camera_id=self._camera_id,
            pixel_threshold=MOTION_PIXEL_THRESHOLD,
        )

        # FFmpeg reader
        self._reader = FFmpegReader(
            rtsp_url=stream['path'],
            camera_id=self._camera_id,
            width=stream.get('width', DEFAULT_WIDTH),
            height=stream.get('height', DEFAULT_HEIGHT),
            fps=stream.get('fps', DEFAULT_FPS),
        )

    def _get_primary_stream(self) -> dict:
        """Return the first stream with 'live' role, or the first stream."""
        streams = self._config.get('streams', [])
        for s in streams:
            roles = s.get('roles', [])
            if 'live' in roles:
                return s
        return streams[0] if streams else {}

    @property
    def camera_id(self) -> str:
        return self._camera_id

    def start(self) -> None:
        """Start the FFmpeg reader which feeds frames into the pipeline."""
        self._reader.start(self._on_frame)
        print(f"[FramePipeline:{self._camera_id}] Started")

    def stop(self) -> None:
        """Stop the FFmpeg reader."""
        self._reader.stop()
        print(f"[FramePipeline:{self._camera_id}] Stopped")

    def _on_frame(self, frame_data: dict) -> None:
        """Callback invoked by FFmpegReader for each decoded frame.

        This runs in the FFmpeg reader thread — it must be fast and
        non-blocking.  Heavy work (encoding) happens here because it
        must happen before the frame is replaced.
        """
        self._frame_counter += 1
        frame: np.ndarray = frame_data['data']

        # Motion gate (always runs to keep background model updated)
        motion_result = self._motion_gate.detect(frame)
        if motion_result['motion_detected']:
            self._motion_queue.put(frame_data)

        # Frame skip for live queue
        if self._frame_counter % self._frame_skip != 0:
            return

        # JPEG encode and push to live queue (non-blocking drop)
        success, jpeg_buffer = cv2.imencode(
            '.jpg', frame,
            [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY],
        )
        if success:
            self._live_queue.put(jpeg_buffer.tobytes())
