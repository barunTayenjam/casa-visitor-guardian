#!/usr/bin/env python3
"""
Tests for bounded queue drop policies.

Covers DropOldestQueue and DropIfFullQueue behaviors including
normal FIFO operation, overflow drop policies, qsize tracking,
and get timeout behavior.
"""

import queue

import pytest

from rtsp_ingestion.queues import DropOldestQueue, DropIfFullQueue


class TestDropOldestQueue:
    """DropOldestQueue: discards oldest when full, retains newest."""

    def test_drop_oldest_queue_drops_when_full(self):
        """After 3 puts into maxsize=2, oldest is dropped and newest two remain."""
        q = DropOldestQueue(2)
        q.put(1)
        q.put(2)
        q.put(3)

        assert q.qsize() == 2
        assert q.get() == 2  # 1 was dropped
        assert q.get() == 3

    def test_drop_oldest_queue_normal_behavior(self):
        """With exactly maxsize items, get() returns in FIFO order."""
        q = DropOldestQueue(2)
        q.put(1)
        q.put(2)

        assert q.get() == 1
        assert q.get() == 2

    def test_queue_qsize(self):
        """qsize() returns correct count at various fill levels."""
        q = DropOldestQueue(3)
        assert q.qsize() == 0
        q.put('a')
        assert q.qsize() == 1
        q.put('b')
        assert q.qsize() == 2
        q.put('c')
        assert q.qsize() == 3

    def test_queue_get_timeout(self):
        """get(timeout=0.1) raises queue.Empty when queue is empty."""
        q = DropOldestQueue(2)
        with pytest.raises(queue.Empty):
            q.get(timeout=0.1)


class TestDropIfFullQueue:
    """DropIfFullQueue: silently discards new items when full."""

    def test_drop_if_full_queue_drops_when_full(self):
        """After 3 puts into maxsize=2, the third item is silently dropped."""
        q = DropIfFullQueue(2)
        q.put(1)
        q.put(2)
        q.put(3)

        assert q.qsize() == 2
        assert q.get() == 1
        assert q.get() == 2

    def test_drop_if_full_queue_normal_behavior(self):
        """With exactly maxsize items, get() twice consumes both."""
        q = DropIfFullQueue(2)
        q.put(1)
        q.put(2)

        assert q.get() == 1
        assert q.get() == 2
        assert q.qsize() == 0
