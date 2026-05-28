#!/usr/bin/env python3
"""
Thread-safe metrics collector with counters and gauges.

Provides atomic increment and gauge-set operations via Lock,
and a snapshot method for atomic reads of all metrics.
"""

import time
from threading import Lock


class MetricsCollector:
    """Thread-safe metrics aggregation with counters and gauges.

    Usage:
        mc = MetricsCollector()
        mc.increment('frames_processed')
        mc.set_gauge('queue_depth', 3)
        snapshot = mc.snapshot()
    """

    def __init__(self):
        self._lock = Lock()
        self._counters: dict[str, int] = {}
        self._gauges: dict[str, float] = {}

    def increment(self, name: str, value: int = 1) -> None:
        """Atomically increment a counter by value (default 1)."""
        with self._lock:
            self._counters[name] = self._counters.get(name, 0) + value

    def set_gauge(self, name: str, value: float) -> None:
        """Atomically set a gauge to the given value."""
        with self._lock:
            self._gauges[name] = value

    def snapshot(self) -> dict:
        """Return an atomic snapshot of all counters and gauges."""
        with self._lock:
            return {
                'counters': dict(self._counters),
                'gauges': dict(self._gauges),
                'timestamp': time.time(),
            }

    def get_counter(self, name: str) -> int:
        """Return current value of a counter, or 0 if not set."""
        with self._lock:
            return self._counters.get(name, 0)

    def get_gauge(self, name: str) -> float:
        """Return current value of a gauge, or 0.0 if not set."""
        with self._lock:
            return self._gauges.get(name, 0.0)
