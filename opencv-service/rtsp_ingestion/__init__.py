#!/usr/bin/env python3
"""
RTSP Ingestion Package — shared data structures and utilities.

All downstream modules (ffmpeg_reader, frame_pipeline, websocket_publisher)
import from this package.
"""

# Config constants
from .config import (
    LIVE_QUEUE_MAXSIZE,
    MOTION_QUEUE_MAXSIZE,
    DETECTION_QUEUE_MAXSIZE,
    WS_HOST,
    WS_PORT,
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    DEFAULT_FPS,
    DETECTION_FPS,
    MOG2_HISTORY,
    MOG2_VAR_THRESHOLD,
    MOTION_PIXEL_THRESHOLD,
    JPEG_QUALITY,
    JPEG_OPTIMIZE,
    FFMPEG_DEFAULT_ARGS,
    METRICS_WS_LATENCY_BUCKETS,
)

# Bounded queues
from .queues import DropOldestQueue, DropIfFullQueue

# Thread-safe metrics
from .metrics import MetricsCollector


class RTSPService:
    """Stub — full implementation in Plan 01-04."""

    def __init__(self, cameras: list[dict], ws_port: int = 9090):
        pass

    def start(self):
        pass

    def stop(self):
        pass


__all__ = [
    'LIVE_QUEUE_MAXSIZE', 'MOTION_QUEUE_MAXSIZE', 'DETECTION_QUEUE_MAXSIZE',
    'WS_HOST', 'WS_PORT',
    'DEFAULT_WIDTH', 'DEFAULT_HEIGHT', 'DEFAULT_FPS', 'DETECTION_FPS',
    'MOG2_HISTORY', 'MOG2_VAR_THRESHOLD', 'MOTION_PIXEL_THRESHOLD',
    'JPEG_QUALITY', 'JPEG_OPTIMIZE',
    'FFMPEG_DEFAULT_ARGS', 'METRICS_WS_LATENCY_BUCKETS',
    'DropOldestQueue', 'DropIfFullQueue',
    'MetricsCollector',
    'RTSPService',
]
