#!/usr/bin/env python3
"""
RTSP Ingestion Configuration Constants
All config values as module-level constants (not inside a class).
"""

import os

# Default queue sizes
LIVE_QUEUE_MAXSIZE = 2
MOTION_QUEUE_MAXSIZE = 5
DETECTION_QUEUE_MAXSIZE = 10

# WebSocket
WS_HOST = os.getenv('WS_HOST', '0.0.0.0')
WS_PORT = int(os.getenv('WS_PORT', '9090'))

# Default camera settings
DEFAULT_WIDTH = 640
DEFAULT_HEIGHT = 360
DEFAULT_FPS = 5
DETECTION_FPS = 4

# MOG2 motion detection
MOG2_HISTORY = 200
MOG2_VAR_THRESHOLD = 16
MOTION_PIXEL_THRESHOLD = 500

# JPEG encoding
JPEG_QUALITY = 60
JPEG_OPTIMIZE = 1

# FFmpeg default arguments for RTSP ingestion
FFMPEG_DEFAULT_ARGS = [
    '-rtsp_transport', 'tcp',
    '-timeout', '5000000',
    '-fflags', '+discardcorrupt+genpts',
    '-max_delay', '1000000',
    '-probesize', '1000000',
    '-analyzeduration', '2000000',
    '-loglevel', 'error',
]

# Metrics latency buckets (milliseconds)
METRICS_WS_LATENCY_BUCKETS = [10, 25, 50, 100, 200, 500]
