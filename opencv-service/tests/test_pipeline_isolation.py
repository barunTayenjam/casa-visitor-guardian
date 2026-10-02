#!/usr/bin/env python3
"""
Wave 2: per-camera isolation in RTSPService._async_start.

A corrupt model file or a single bad camera must not kill ingestion for the
other cameras — and failures must be logged, not swallowed.
"""

import asyncio
from unittest import mock

import pytest

from rtsp_ingestion import RTSPService


def _cameras(*ids):
    return [
        {
            'id': cid,
            'name': cid,
            'enabled': True,
            'streams': [{'path': 'rtsp://x/stream', 'roles': ['live', 'detect'],
                         'width': 640, 'height': 360, 'fps': 5}],
        }
        for cid in ids
    ]


def _ok_pipeline_ctor(failures: dict):
    """Pipeline class: ctor and start both record successes / raise."""
    started = []

    class FakePipeline:
        def __init__(self, cam, publisher):
            self._cam = cam
            if cam['id'] in failures.get('init', set()):
                raise RuntimeError(f"boom-init-{cam['id']}")

        def set_face_recognition(self, fn):
            pass

        def start(self):
            if self._cam['id'] in failures.get('start', set()):
                raise RuntimeError(f"boom-start-{self._cam['id']}")
            started.append(self._cam['id'])

    return FakePipeline, started


async def _run(service):
    service._publisher.set_live_callbacks = lambda a, b: None
    service._publisher.start = _noop
    await service._async_start()


async def _noop():
    return None


@pytest.mark.asyncio
async def test_one_bad_camera_does_not_kill_others(capsys):
    service = RTSPService(_cameras('good1', 'bad', 'good2'))
    FakePipeline, started = _ok_pipeline_ctor({'init': {'bad'}})
    with mock.patch('rtsp_ingestion.FramePipeline', FakePipeline):
        await _run(service)
    assert sorted(started) == ['good1', 'good2']
    out = capsys.readouterr().out
    assert 'bad' in out, f'failure not logged, got: {out!r}'


@pytest.mark.asyncio
async def test_pipeline_start_failure_is_contained(capsys):
    service = RTSPService(_cameras('good1', 'badstart', 'good2'))
    FakePipeline, started = _ok_pipeline_ctor({'start': {'badstart'}})
    with mock.patch('rtsp_ingestion.FramePipeline', FakePipeline):
        await _run(service)
    assert sorted(started) == ['good1', 'good2']
    out = capsys.readouterr().out
    assert 'badstart' in out


@pytest.mark.asyncio
async def test_start_non_blocking_surfaces_start_errors(capsys):
    """start_non_blocking must not fire-and-forget _async_start silently."""
    service = RTSPService(_cameras('boom'))
    FakePipeline, started = _ok_pipeline_ctor({'init': {'boom'}})
    service._publisher.set_live_callbacks = lambda a, b: None
    service._publisher.start = _noop
    with mock.patch('rtsp_ingestion.FramePipeline', FakePipeline):
        service.start_non_blocking()
        await asyncio.sleep(0.5)
    out = capsys.readouterr().out
    assert 'boom' in out, f'failure not logged, got: {out!r}'


def test_corrupt_model_returns_false_not_raise(tmp_path, capsys):
    """readNet raising on a corrupt file must degrade to ok=False, not crash the pipeline."""
    import cv2

    from rtsp_ingestion.frame_pipeline import InProcessYOLO

    (tmp_path / 'yolov8n.onnx').write_bytes(b'not a real model')
    (tmp_path / 'yolov5n.onnx').write_bytes(b'not a real model')
    (tmp_path / 'yolov4-tiny.weights').write_bytes(b'not a real model')
    (tmp_path / 'yolov4-tiny.cfg').write_text('net {}')
    detector = InProcessYOLO(str(tmp_path))
    with mock.patch.object(cv2.dnn, 'readNet', side_effect=cv2.error('corrupt')):
        assert detector.initialize() is False
    out = capsys.readouterr().out
    assert 'corrupt' in out
