"""
Tests for WebSocketPublisher — async frame streaming with subscribe/unsubscribe.

Uses a real WebSocket client to connect to the publisher and verify
frame delivery, subscribe/unsubscribe flow, and unknown camera handling.
"""

import asyncio
import json
import time

import pytest
import websockets

from rtsp_ingestion.websocket_publisher import WebSocketPublisher


@pytest.fixture
def event_loop():
    """Use a fresh event loop per test."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.mark.asyncio
async def test_subscribe_and_receive_frames():
    """Subscribing to a camera delivers frames from its queue."""
    publisher = WebSocketPublisher(host="127.0.0.1", port=18789)
    queue = publisher.add_frame_queue("cam1")

    await publisher.start()
    try:
        # Push a frame to the queue
        queue.put(b"fake-jpeg-data-1")
        queue.put(b"fake-jpeg-data-2")

        # Connect a client and subscribe
        async with websockets.connect("ws://127.0.0.1:18789") as ws:
            await ws.send(json.dumps({"type": "subscribe", "cameraId": "cam1"}))

            # Receive metadata
            metadata = await asyncio.wait_for(ws.recv(), timeout=2.0)
            meta = json.loads(metadata)
            assert meta["type"] == "frame"
            assert meta["cameraId"] == "cam1"
            assert "timestamp" in meta

            # Receive frame data (FIFO order)
            frame_data = await asyncio.wait_for(ws.recv(), timeout=2.0)
            assert frame_data in (b"fake-jpeg-data-1", b"fake-jpeg-data-2")
    finally:
        await publisher.stop()


@pytest.mark.asyncio
async def test_subscribe_unknown_camera_returns_error():
    """Subscribing to a non-existent camera returns an error message."""
    publisher = WebSocketPublisher(host="127.0.0.1", port=18790)
    await publisher.start()
    try:
        async with websockets.connect("ws://127.0.0.1:18790") as ws:
            await ws.send(json.dumps({"type": "subscribe", "cameraId": "nonexistent"}))
            response = await asyncio.wait_for(ws.recv(), timeout=2.0)
            msg = json.loads(response)
            assert msg["type"] == "error"
            assert "Unknown camera" in msg["message"]
    finally:
        await publisher.stop()


@pytest.mark.asyncio
async def test_unsubscribe_stops_frame_delivery():
    """After unsubscribing, no more frames are received for that camera."""
    publisher = WebSocketPublisher(host="127.0.0.1", port=18791)
    queue = publisher.add_frame_queue("cam2")

    await publisher.start()
    try:
        async with websockets.connect("ws://127.0.0.1:18791") as ws:
            # Subscribe
            await ws.send(json.dumps({"type": "subscribe", "cameraId": "cam2"}))

            # Push a frame
            queue.put(b"frame-before-unsub")

            # Receive it
            await asyncio.wait_for(ws.recv(), timeout=2.0)  # metadata
            await asyncio.wait_for(ws.recv(), timeout=2.0)  # frame

            # Unsubscribe
            await ws.send(json.dumps({"type": "unsubscribe", "cameraId": "cam2"}))

            # Push another frame — should NOT be received
            queue.put(b"frame-after-unsub")

            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(ws.recv(), timeout=1.0)
    finally:
        await publisher.stop()


@pytest.mark.asyncio
async def test_multiple_subscribers():
    """Multiple clients subscribed to the same camera all receive frames."""
    publisher = WebSocketPublisher(host="127.0.0.1", port=18792)
    queue = publisher.add_frame_queue("cam3")

    await publisher.start()
    try:
        async with (
            websockets.connect("ws://127.0.0.1:18792") as ws1,
            websockets.connect("ws://127.0.0.1:18792") as ws2,
        ):
            await ws1.send(json.dumps({"type": "subscribe", "cameraId": "cam3"}))
            await ws2.send(json.dumps({"type": "subscribe", "cameraId": "cam3"}))

            queue.put(b"shared-frame")

            for ws in (ws1, ws2):
                meta = await asyncio.wait_for(ws.recv(), timeout=2.0)
                assert json.loads(meta)["cameraId"] == "cam3"
                data = await asyncio.wait_for(ws.recv(), timeout=2.0)
                assert data == b"shared-frame"
    finally:
        await publisher.stop()
