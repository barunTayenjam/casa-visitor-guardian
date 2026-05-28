#!/usr/bin/env python3
"""
Bounded queue implementations with drop policies for realtime frame processing.

DropOldestQueue — when full, discards oldest item before inserting new one.
DropIfFullQueue — when full, silently discards new items.

Both are thread-safe via queue.Queue's built-in lock.
"""

import queue
from typing import Any


class DropOldestQueue:
    """Bounded queue: when full, discards oldest item before put.

    Ensures the newest data is always available by evicting the oldest
    item when the queue reaches capacity. Suitable for live preview
    frames and detection frames where freshness matters.
    """

    def __init__(self, maxsize: int):
        self._q = queue.Queue(maxsize=maxsize)

    def put(self, item: Any) -> None:
        if self._q.full():
            try:
                self._q.get_nowait()  # discard oldest
            except queue.Empty:
                pass
        self._q.put(item)

    def get(self, timeout: float | None = None) -> Any:
        return self._q.get(timeout=timeout)

    def qsize(self) -> int:
        return self._q.qsize()


class DropIfFullQueue:
    """Bounded queue: when full, silently discards new items.

    Prevents motion storms from overwhelming detection by dropping
    incoming items when the queue is at capacity. Suitable for the
    motion event queue where overload protection matters more than
    completeness.
    """

    def __init__(self, maxsize: int):
        self._q = queue.Queue(maxsize=maxsize)

    def put(self, item: Any) -> None:
        if not self._q.full():
            self._q.put(item)

    def get(self, timeout: float | None = None) -> Any:
        return self._q.get(timeout=timeout)

    def qsize(self) -> int:
        return self._q.qsize()
