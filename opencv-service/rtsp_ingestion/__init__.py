#!/usr/bin/env python3
"""
RTSP Ingestion Package — shared data structures and utilities.

All downstream modules (ffmpeg_reader, frame_pipeline, websocket_publisher)
import from this package.
"""

import asyncio
import json
import os
import signal
import threading
from typing import Optional

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
    INFERENCE_BACKEND,
    INFERENCE_TARGET,
)

# Bounded queues
from .queues import DropOldestQueue, DropIfFullQueue

# Thread-safe metrics
from .metrics import MetricsCollector

# Pipeline modules
from .ffmpeg_reader import FFmpegReader
from .frame_pipeline import FramePipeline, MotionGate
from .websocket_publisher import WebSocketPublisher
from .byte_tracker import ByteTracker


class RTSPService:
    """Orchestrates RTSP ingestion for all cameras.

    Loads camera configuration, starts per-camera FramePipeline instances,
    runs the WebSocketPublisher, and handles graceful shutdown.

    Usage:
        service = RTSPService(cameras)
        service.start()
        # Blocks until SIGINT/SIGTERM
    """

    def __init__(
        self,
        cameras: list[dict],
        ws_host: str = WS_HOST,
        ws_port: int = WS_PORT,
    ):
        self._cameras = cameras
        self._publisher = WebSocketPublisher(host=ws_host, port=ws_port)
        self._pipelines: dict[str, FramePipeline] = {}
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def start(self) -> None:
        """Start all pipelines and the WebSocket server.

        This call blocks until the service is stopped via signal or stop().
        """
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

        try:
            self._loop.run_until_complete(self._async_start())
            self._loop.run_forever()
        except KeyboardInterrupt:
            pass
        finally:
            self._loop.run_until_complete(self._async_stop())
            self._loop.close()

    async def _async_start(self) -> None:
        """Start WebSocket publisher and all camera pipelines."""
        await self._publisher.start()

        for cam in self._cameras:
            if not cam.get('enabled', True):
                continue
            pipeline = FramePipeline(cam, self._publisher)
            self._pipelines[cam['id']] = pipeline
            pipeline.start()

        active = [c['id'] for c in self._cameras if c.get('enabled', True)]
        print(f"[RTSPService] Started {len(active)} pipelines: {active}")

    async def _async_stop(self) -> None:
        """Stop all pipelines and the WebSocket server."""
        for pipeline in self._pipelines.values():
            pipeline.stop()
        self._pipelines.clear()
        await self._publisher.stop()

    def start_non_blocking(self) -> None:
        """Start pipelines in a background thread (for Flask embedding).

        Unlike start() which blocks, this returns immediately and runs
        the event loop in a daemon thread.
        """
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        t = threading.Thread(target=self._loop.run_forever, daemon=True)
        t.start()
        asyncio.run_coroutine_threadsafe(self._async_start(), self._loop)

    def stop(self) -> None:
        """Signal the event loop to stop."""
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self._async_stop(), self._loop)
            self._loop.call_soon_threadsafe(self._loop.stop)

    def get_metrics_snapshot(self) -> dict:
        """Return a snapshot of current metrics."""
        pipelines_metrics = {
            cid: pipeline.get_yolo_metrics()
            for cid, pipeline in self._pipelines.items()
        }
        return {
            'pipelines': list(self._pipelines.keys()),
            'pipeline_count': len(self._pipelines),
            'publisher_running': self._publisher._running if hasattr(self._publisher, '_running') else False,
            'inference': pipelines_metrics,
        }

    def get_status(self) -> dict:
        """Return current service status."""
        return {
            'running': self._loop is not None and self._loop.is_running(),
            'pipelines': [
                {'id': cid, 'running': True}
                for cid in self._pipelines
            ],
            'camera_count': len(self._pipelines),
        }


def load_camera_config(path: str) -> list[dict]:
    """Load camera configuration from a JSON file.

    Expects the same format as server/cameras.example.json:
    a list of camera objects with 'id', 'enabled', 'streams', etc.
    """
    if not os.path.exists(path):
        print(f"[RTSPService] Camera config not found: {path}")
        return []
    with open(path, 'r') as f:
        return json.load(f)


__all__ = [
    # Config
    'LIVE_QUEUE_MAXSIZE', 'MOTION_QUEUE_MAXSIZE', 'DETECTION_QUEUE_MAXSIZE',
    'WS_HOST', 'WS_PORT',
    'DEFAULT_WIDTH', 'DEFAULT_HEIGHT', 'DEFAULT_FPS', 'DETECTION_FPS',
    'MOG2_HISTORY', 'MOG2_VAR_THRESHOLD', 'MOTION_PIXEL_THRESHOLD',
    'JPEG_QUALITY', 'JPEG_OPTIMIZE',
    'FFMPEG_DEFAULT_ARGS', 'METRICS_WS_LATENCY_BUCKETS',
    'INFERENCE_BACKEND', 'INFERENCE_TARGET',

    # Data structures
    'DropOldestQueue', 'DropIfFullQueue',
    'MetricsCollector',

    # Pipeline
    'FFmpegReader',
    'MotionGate',
    'FramePipeline',
    'WebSocketPublisher',
    'RTSPService',

    # Helpers
    'load_camera_config',
]
