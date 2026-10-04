#!/usr/bin/env python3
"""AdaptiveFrameProcessor must not block the detection loop.

The current implementation calls psutil.cpu_percent(interval=0.1), which blocks
for 0.1s on EVERY frame — on a 3-CPU box, that alone burns ~10% of one core.

Expected behavior:
- Use psutil.cpu_percent(interval=None) (non-blocking, delta since last call).
- Only sample CPU periodically (e.g., every Nth call), caching the last value.
"""
import time
from unittest import mock

import pytest

from rtsp_ingestion.frame_pipeline import AdaptiveFrameProcessor


def test_should_process_frame_does_not_block():
    """Calling should_process_frame repeatedly must be fast (no 0.1s sleeps)."""
    proc = AdaptiveFrameProcessor()
    start = time.perf_counter()
    for _ in range(5):
        proc.should_process_frame()
    elapsed = time.perf_counter() - start
    # 5 calls with interval=0.1 would take ≥0.5s; non-blocking takes milliseconds
    assert elapsed < 0.25, (
        f"5 calls took {elapsed:.2f}s — cpu_percent is still blocking per call"
    )


def test_cpu_sampled_nonblocking_when_available():
    """psutil must be called with interval=None (non-blocking delta mode)."""
    proc = AdaptiveFrameProcessor()
    # psutil is imported directly into the function scope; patch it there
    with mock.patch('rtsp_ingestion.frame_pipeline.psutil') as mock_psutil:
        mock_psutil.cpu_percent.return_value = 10.0
        for _ in range(10):
            proc.should_process_frame()
        for call in mock_psutil.cpu_percent.call_args_list:
            args, kwargs = call
            interval = kwargs.get('interval', args[0] if args else 'missing')
            assert interval is None, (
                f"cpu_percent called with interval={interval!r}, expected None"
            )


def test_high_cpu_triggers_skip_still_works():
    """Behavior preserved: sustained high CPU still causes frame skipping."""
    proc = AdaptiveFrameProcessor()
    with mock.patch(
        'rtsp_ingestion.frame_pipeline.psutil.cpu_percent',
        return_value=90.0,
    ):
        results = [proc.should_process_frame() for _ in range(20)]
    # With skip_interval=3, roughly 1 in 3 processed while skipping
    assert results.count(True) < len(results), (
        "high CPU should cause some frames to be skipped"
    )


if __name__ == '__main__':
    pytest.main([__file__])
