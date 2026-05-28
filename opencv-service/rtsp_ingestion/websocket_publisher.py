#!/usr/bin/env python3
"""
Async WebSocket publisher — streams live camera frames to Node.js gateway.

Protocol (per frame):
  1. Text message: JSON metadata  {"cameraId": "...", "timestamp": ..., "type": "frame"}
  2. Binary message: JPEG-encoded frame bytes

Client commands (incoming text):
  - {"type": "subscribe",   "cameraId": "cam1"}
  - {"type": "unsubscribe", "cameraId": "cam1"}

Usage:
    publisher = WebSocketPublisher(host="0.0.0.0", port=9090)
    publisher.add_frame_queue("cam1", some_queue)
    await publisher.start()
    # ... later
    await publisher.stop()
"""

import asyncio
import json
import time
from typing import Callable, Optional

import websockets
from websockets.server import WebSocketServerProtocol

from .queues import DropOldestQueue
from .config import LIVE_QUEUE_MAXSIZE, JPEG_QUALITY, JPEG_OPTIMIZE


class WebSocketPublisher:
    """Async WebSocket server that streams camera frames to connected clients.

    Each camera has a dedicated DropOldestQueue that the frame pipeline
    writes to.  When a client subscribes to a camera, the publisher polls
    that camera's queue in a tight loop and sends frames as text+binary pairs.

    Attributes:
        host:           Bind address.
        port:           Bind port.
        _queues:        Mapping camera_id → DropOldestQueue of bytes (JPEG).
        _subscriptions: Mapping camera_id → set of websocket connections.
        _server:        The running websockets server.
        _tasks:         Per-camera publisher asyncio tasks.
        _running:       Whether the event loop is active.
    """

    def __init__(self, host: str = "0.0.0.0", port: int = 9090):
        self.host = host
        self.port = port
        self._queues: dict[str, DropOldestQueue] = {}
        self._subscriptions: dict[str, set] = {}
        self._server: Optional[websockets.WebSocketServer] = None
        self._tasks: dict[str, asyncio.Task] = {}
        self._running = False

    def add_frame_queue(self, camera_id: str) -> DropOldestQueue:
        """Register a camera's frame queue.  Returns the queue for the pipeline to fill."""
        if camera_id not in self._queues:
            self._queues[camera_id] = DropOldestQueue(LIVE_QUEUE_MAXSIZE)
            self._subscriptions[camera_id] = set()
        return self._queues[camera_id]

    async def start(self) -> None:
        """Start the WebSocket server."""
        self._running = True
        self._server = await websockets.serve(
            self._handle_connection,
            self.host,
            self.port,
            ping_interval=30,
            ping_timeout=10,
        )
        print(f"[WebSocketPublisher] Listening on ws://{self.host}:{self.port}")

    async def stop(self) -> None:
        """Gracefully stop the server and all publisher tasks."""
        self._running = False
        for task in self._tasks.values():
            task.cancel()
        self._tasks.clear()
        if self._server:
            self._server.close()
            await self._server.wait_closed()
        print("[WebSocketPublisher] Stopped")

    async def _handle_connection(self, ws: WebSocketServerProtocol) -> None:
        """Handle a single WebSocket client connection."""
        print(f"[WebSocketPublisher] Client connected: {ws.remote_address}")
        client_subs: set[str] = set()
        try:
            async for raw_message in ws:
                try:
                    msg = json.loads(raw_message)
                except (json.JSONDecodeError, TypeError):
                    continue

                msg_type = msg.get("type")
                camera_id = msg.get("cameraId")

                if msg_type == "subscribe" and camera_id:
                    await self._subscribe(ws, camera_id)
                    client_subs.add(camera_id)
                elif msg_type == "unsubscribe" and camera_id:
                    await self._unsubscribe(ws, camera_id)
                    client_subs.discard(camera_id)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            for camera_id in client_subs:
                self._subscriptions.get(camera_id, set()).discard(ws)
            print(f"[WebSocketPublisher] Client disconnected: {ws.remote_address}")

    async def _subscribe(self, ws: WebSocketServerProtocol, camera_id: str) -> None:
        """Subscribe a client to a camera's frame stream."""
        if camera_id not in self._queues:
            await ws.send(json.dumps({
                "type": "error",
                "message": f"Unknown camera: {camera_id}",
            }))
            return

        self._subscriptions[camera_id].add(ws)
        print(f"[WebSocketPublisher] {ws.remote_address} subscribed to {camera_id}")

        if camera_id not in self._tasks or self._tasks[camera_id].done():
            self._tasks[camera_id] = asyncio.create_task(
                self._publish_loop(camera_id)
            )

    async def _unsubscribe(self, ws: WebSocketServerProtocol, camera_id: str) -> None:
        """Unsubscribe a client from a camera's frame stream."""
        self._subscriptions.get(camera_id, set()).discard(ws)
        print(f"[WebSocketPublisher] {ws.remote_address} unsubscribed from {camera_id}")

        if camera_id in self._tasks and not self._subscriptions[camera_id]:
            self._tasks[camera_id].cancel()
            del self._tasks[camera_id]

    async def _publish_loop(self, camera_id: str) -> None:
        """Continuously poll a camera's queue and send frames to all subscribers."""
        queue = self._queues.get(camera_id)
        if queue is None:
            return

        print(f"[WebSocketPublisher] Started publish loop for {camera_id}")
        while self._running:
            try:
                frame_data = await asyncio.get_event_loop().run_in_executor(
                    None, queue.get, 0.05
                )
            except Exception:
                continue

            if not self._subscriptions.get(camera_id):
                continue

            metadata = {
                "type": "frame",
                "cameraId": camera_id,
                "timestamp": time.time(),
            }
            metadata_bytes = json.dumps(metadata).encode("utf-8")

            dead_clients: set = set()
            for ws in self._subscriptions[camera_id]:
                try:
                    await ws.send(metadata_bytes)
                    await ws.send(frame_data)
                except websockets.exceptions.ConnectionClosed:
                    dead_clients.add(ws)

            self._subscriptions[camera_id] -= dead_clients

            if not self._subscriptions[camera_id]:
                self._tasks[camera_id].cancel()
                break

        print(f"[WebSocketPublisher] Stopped publish loop for {camera_id}")
