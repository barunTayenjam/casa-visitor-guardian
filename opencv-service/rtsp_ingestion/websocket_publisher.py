#!/usr/bin/env python3
"""
Async WebSocket publisher — streams live camera frames and tracking events
to the Node.js gateway.

Protocol:
   Frames (per frame):
      1. Text: {"cameraId":"...","timestamp":...,"type":"frame"}
      2. Binary: JPEG bytes

   Events (per event):
      1. Text: {"cameraId":"...","timestamp":...,"type":"event","eventType":"track_started",...}
      2. Binary: (empty or JPEG snapshot)

Client commands (incoming text):
   - {"type":"subscribe","cameraId":"cam1"}
   - {"type":"unsubscribe","cameraId":"cam1"}
"""

import asyncio
import json
import time
from typing import Optional

import websockets
from websockets.server import WebSocketServerProtocol

from .queues import DropOldestQueue
from .config import LIVE_QUEUE_MAXSIZE


class WebSocketPublisher:
    """Async WebSocket server streaming camera frames + tracking events."""

    def __init__(self, host: str = "0.0.0.0", port: int = 9090):
        self.host = host
        self.port = port
        self._frame_queues: dict[str, DropOldestQueue] = {}
        self._event_queues: dict[str, DropOldestQueue] = {}
        self._subscriptions: dict[str, set] = {}
        self._server: Optional[websockets.WebSocketServer] = None
        self._tasks: dict[str, asyncio.Task] = {}
        self._running = False

    def add_frame_queue(self, camera_id: str) -> DropOldestQueue:
        if camera_id not in self._frame_queues:
            self._frame_queues[camera_id] = DropOldestQueue(LIVE_QUEUE_MAXSIZE)
            self._subscriptions.setdefault(camera_id, set())
        return self._frame_queues[camera_id]

    def add_event_queue(self, camera_id: str) -> DropOldestQueue:
        if camera_id not in self._event_queues:
            self._event_queues[camera_id] = DropOldestQueue(100)
        return self._event_queues[camera_id]

    async def start(self) -> None:
        self._running = True
        self._server = await websockets.serve(
            self._handle_connection, self.host, self.port,
            ping_interval=30, ping_timeout=10,
        )
        print(f"[WebSocketPublisher] Listening on ws://{self.host}:{self.port}")

    async def stop(self) -> None:
        self._running = False
        for task in self._tasks.values():
            task.cancel()
        self._tasks.clear()
        if self._server:
            self._server.close()
            await self._server.wait_closed()
        print("[WebSocketPublisher] Stopped")

    async def _handle_connection(self, ws: WebSocketServerProtocol) -> None:
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
        if camera_id not in self._frame_queues:
            await ws.send(json.dumps({"type": "error", "message": f"Unknown camera: {camera_id}"}))
            return
        self._subscriptions[camera_id].add(ws)
        print(f"[WebSocketPublisher] {ws.remote_address} subscribed to {camera_id}")
        if camera_id not in self._tasks or self._tasks[camera_id].done():
            self._tasks[camera_id] = asyncio.create_task(self._publish_loop(camera_id))

    async def _unsubscribe(self, ws: WebSocketServerProtocol, camera_id: str) -> None:
        self._subscriptions.get(camera_id, set()).discard(ws)
        print(f"[WebSocketPublisher] {ws.remote_address} unsubscribed from {camera_id}")
        if camera_id in self._tasks and not self._subscriptions.get(camera_id):
            self._tasks[camera_id].cancel()
            del self._tasks[camera_id]

    async def _broadcast(self, camera_id: str, metadata: dict, binary: bytes = b"") -> None:
        subs = self._subscriptions.get(camera_id)
        if not subs:
            return
        metadata_text = json.dumps(metadata)
        dead: set = set()
        for ws in list(subs):
            try:
                await ws.send(metadata_text)
                if binary:
                    await ws.send(binary)
            except websockets.exceptions.ConnectionClosed:
                dead.add(ws)
        subs -= dead

    async def _publish_loop(self, camera_id: str) -> None:
        frame_q = self._frame_queues.get(camera_id)
        event_q = self._event_queues.get(camera_id)
        if frame_q is None:
            return
        print(f"[WebSocketPublisher] Started publish loop for {camera_id}")
        while self._running:
            # Drain event queue first (high priority)
            if event_q is not None:
                while True:
                    try:
                        ev = event_q.get_nowait()
                    except Exception:
                        break
                    await self._broadcast(camera_id, {
                        "type": "event",
                        "cameraId": camera_id,
                        "timestamp": time.time(),
                        **ev,
                    })

            # Then send latest frame
            try:
                frame_data = await asyncio.get_event_loop().run_in_executor(
                    None, frame_q.get, 0.05
                )
            except Exception:
                continue

            await self._broadcast(camera_id, {
                "type": "frame",
                "cameraId": camera_id,
                "timestamp": time.time(),
            }, frame_data)

            if not self._subscriptions.get(camera_id):
                self._tasks.pop(camera_id, None)
                break

        print(f"[WebSocketPublisher] Stopped publish loop for {camera_id}")
