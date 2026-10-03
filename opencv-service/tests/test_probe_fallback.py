#!/usr/bin/env python3
"""
Wave 5: ffprobe fallback must not silently desync the byte stream.

If the probe fails, ffmpeg emits NATIVE-resolution rawvideo (ffmpeg has no
-vf scale in the command), so slicing `fallback_w * fallback_h * 3` bytes
garbles frames forever with no error. Guard: on probe failure the reader
either raises, or sets _scale=True so the command downscales to the
fallback dims.
"""

from unittest import mock

from rtsp_ingestion.ffmpeg_reader import FFmpegReader


def test_probe_failure_never_leaves_scale_mismatch():
    with mock.patch("subprocess.run", side_effect=RuntimeError("no ffprobe")):
        try:
            reader = FFmpegReader(
                rtsp_url="rtsp://x/stream",
                camera_id="probe-test",
                width=640,
                height=360,
                fps=5,
                scale=False,  # triggers the probe path
            )
        except Exception:
            return  # raising loudly is acceptable: it cannot desync silently
        # If construction succeeded, the command must scale to the fallback dims.
        assert reader._scale is True, (
            "probe fallback without scaling desyncs the raw byte stream"
        )
        cmd = reader._build_command()
        assert any("scale=" in str(part) for part in cmd), (
            "no -vf scale in command, ffmpeg would emit native resolution"
        )