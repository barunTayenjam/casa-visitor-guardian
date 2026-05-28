#!/usr/bin/env python3
"""
FFmpeg subprocess reader — captures raw BGR24 frames from RTSP streams.

Spawning: FFmpeg is launched as a subprocess with raw video piped to stdout.
Each frame is read as a raw bytes buffer and reshaped into a numpy array.

Reconnection: On process exit / error, the reader backs off exponentially
(1s → 30s max) and retries indefinitely.

Usage:
    reader = FFmpegReader("rtsp://...", camera_id="cam1")
    reader.start()
    for frame in reader:
        # frame is a dict with 'data' (np.ndarray), 'timestamp', 'camera_id'
    reader.stop()
"""

import subprocess
import threading
import time
import numpy as np
from typing import Optional

from .config import FFMPEG_DEFAULT_ARGS, DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_FPS


class FFmpegReader:
    """Reads raw BGR24 frames from an RTSP stream via FFmpeg subprocess.

    Runs a dedicated thread that continuously reads frames from FFmpeg stdout
    and feeds them into a callback.  On disconnect the subprocess is re-spawned
    with exponential back-off.

    Attributes:
        camera_id:  Unique identifier for the camera (used in metadata).
        rtsp_url:   Full RTSP URL including credentials.
        width:      Target decode width (FFmpeg `-vf scale`).
        height:     Target decode height.
        fps:        Target frame rate (FFmpeg `-r`).
        running:    Whether the reader loop is active.
    """

    def __init__(
        self,
        rtsp_url: str,
        camera_id: str = "default",
        width: int = DEFAULT_WIDTH,
        height: int = DEFAULT_HEIGHT,
        fps: int = DEFAULT_FPS,
    ):
        self.rtsp_url = rtsp_url
        self.camera_id = camera_id
        self.width = width
        self.height = height
        self.fps = fps
        self.running = False
        self._process: Optional[subprocess.Popen] = None
        self._thread: Optional[threading.Thread] = None
        self._callback = None
        self._frame_size = width * height * 3  # BGR24
        self._reconnect_delay = 1.0
        self._max_reconnect_delay = 30.0

    def start(self, callback) -> None:
        """Start the reader thread.

        Args:
            callback:  Callable called with a dict per frame:
                       {'data': np.ndarray (H×W×3 BGR), 'timestamp': float,
                        'camera_id': str}
        """
        if self.running:
            return
        self._callback = callback
        self.running = True
        self._thread = threading.Thread(
            target=self._read_loop, name=f"ffmpeg-{self.camera_id}", daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        """Signal the reader thread to stop and kill the FFmpeg subprocess."""
        self.running = False
        self._kill_process()

    def _build_command(self) -> list[str]:
        """Build the FFmpeg command line for raw BGR24 output."""
        return [
            "ffmpeg",
            *FFMPEG_DEFAULT_ARGS,
            "-i", self.rtsp_url,
            "-vf", f"scale={self.width}:{self.height}",
            "-r", str(self.fps),
            "-f", "rawvideo",
            "-pix_fmt", "bgr24",
            "-an",
            "pipe:1",
        ]

    def _read_loop(self) -> None:
        """Main loop: spawn FFmpeg, read frames, handle reconnection."""
        while self.running:
            try:
                self._spawn_process()
                self._reconnect_delay = 1.0  # reset on successful spawn
                self._read_frames()
            except Exception as e:
                if not self.running:
                    break
                print(f"[FFmpegReader:{self.camera_id}] Error: {e}")
                self._sleep_before_reconnect()

    def _spawn_process(self) -> None:
        """Launch the FFmpeg subprocess."""
        cmd = self._build_command()
        self._process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            bufsize=10 ** 8,
        )
        print(f"[FFmpegReader:{self.camera_id}] Spawned FFmpeg (pid={self._process.pid})")

    def _read_frames(self) -> None:
        """Read raw frames from the subprocess stdout pipe."""
        assert self._process is not None
        assert self._process.stdout is not None

        while self.running:
            raw_bytes = self._process.stdout.read(self._frame_size)
            if not raw_bytes or len(raw_bytes) < self._frame_size:
                if self.running:
                    print(f"[FFmpegReader:{self.camera_id}] Short read / EOF — restarting")
                break

            frame = np.frombuffer(raw_bytes, dtype=np.uint8).reshape(
                (self.height, self.width, 3)
            )

            self._callback({
                'data': frame,
                'timestamp': time.time(),
                'camera_id': self.camera_id,
            })

    def _kill_process(self) -> None:
        """Terminate the FFmpeg subprocess if still alive."""
        if self._process is not None:
            try:
                self._process.kill()
                self._process.wait(timeout=5)
            except Exception:
                pass
            self._process = None

    def _sleep_before_reconnect(self) -> None:
        """Exponential back-off sleep with early exit on stop."""
        delay = self._reconnect_delay
        if delay < self._max_reconnect_delay:
            self._reconnect_delay = min(delay * 2, self._max_reconnect_delay)
        print(f"[FFmpegReader:{self.camera_id}] Reconnecting in {delay:.0f}s...")
        self._sleep_interruptible(delay)

    def _sleep_interruptible(self, seconds: float) -> None:
        """Sleep in short intervals so stop() is responsive."""
        interval = 0.1
        elapsed = 0.0
        while elapsed < seconds and self.running:
            time.sleep(interval)
            elapsed += interval
