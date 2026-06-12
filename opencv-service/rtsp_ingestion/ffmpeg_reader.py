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

import json
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
        width:      Output frame width (native if scale=False).
        height:     Output frame height (native if scale=False).
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
        scale: bool = True,
    ):
        self.rtsp_url = rtsp_url
        self.camera_id = camera_id
        self.fps = fps
        self._scale = scale
        self.running = False
        self._process: Optional[subprocess.Popen] = None
        self._thread: Optional[threading.Thread] = None
        self._callback = None
        self._reconnect_delay = 1.0
        self._max_reconnect_delay = 30.0

        if scale:
            self.width = width
            self.height = height
        else:
            self.width, self.height = self._probe_resolution(width, height)

        self._frame_size = self.width * self.height * 3

    MAX_OUTPUT_WIDTH = 1280
    MAX_OUTPUT_HEIGHT = 720

    def _probe_resolution(self, fallback_w: int, fallback_h: int) -> tuple[int, int]:
        try:
            cmd = [
                "ffprobe", "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height",
                "-of", "json",
                "-rtsp_transport", "tcp",
                self.rtsp_url,
            ]
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10)
            info = json.loads(result.stdout)
            stream = info.get("streams", [{}])[0]
            w = int(stream.get("width", fallback_w))
            h = int(stream.get("height", fallback_h))
            if w > self.MAX_OUTPUT_WIDTH or h > self.MAX_OUTPUT_HEIGHT:
                print(f"[FFmpegReader:{self.camera_id}] Native {w}x{h} exceeds cap {self.MAX_OUTPUT_WIDTH}x{self.MAX_OUTPUT_HEIGHT}, will scale")
                self._scale = True
                scale = min(self.MAX_OUTPUT_WIDTH / w, self.MAX_OUTPUT_HEIGHT / h)
                w, h = int(w * scale), int(h * scale)
            print(f"[FFmpegReader:{self.camera_id}] Probed resolution: {w}x{h} (scale={'yes' if self._scale else 'no'})")
            return w, h
        except Exception as e:
            print(f"[FFmpegReader:{self.camera_id}] Probe failed ({e}), using {fallback_w}x{fallback_h}")
            return fallback_w, fallback_h

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
        cmd = [
            "ffmpeg",
            *FFMPEG_DEFAULT_ARGS,
            "-i", self.rtsp_url,
        ]
        if self._scale:
            cmd += ["-vf", f"scale={self.width}:{self.height}"]
        cmd += [
            "-r", str(self.fps),
            "-f", "rawvideo",
            "-pix_fmt", "bgr24",
            "-an",
            "pipe:1",
        ]
        return cmd

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
