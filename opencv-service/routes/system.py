from flask import Blueprint, jsonify
from datetime import datetime
import os

import state
from scene_analyzer import SceneAnalyzer

system_bp = Blueprint('system', __name__)


@system_bp.route('/api/rtsp/metrics', methods=['GET'])
def rtsp_metrics():
    if state._rtsp_service is None:
        return jsonify({'status': 'not_started'})
    try:
        return jsonify(state._rtsp_service.get_metrics_snapshot())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@system_bp.route('/health')
def health():
    model_type = 'YOLO'
    model_name = 'yolov8s'
    if state.detector and state.detector.model_type:
        model_name = f"yolov8{state.detector.model_type}" if state.detector.model_type in ('s', 'n', 'm') else state.detector.model_type
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'service': 'opencv-detection',
        'version': os.getenv('SERVICE_VERSION', '1.0.0'),
        'detectionMode': 'yolo',
        'model': {
            'type': model_type,
            'name': model_name,
            'initialized': state.detector.initialized if state.detector else False,
            'classCount': len(state.class_names) if state.class_names else 0
        },
        'sceneAnalysis': True,
        'personAnalysis': True,
        'threatDetection': True,
        'endpoints': [
            'POST /detect-objects',
            'POST /detect-motion',
            'POST /detect-and-draw',
            'POST /recognize-faces',
            'POST /detect-batch',
            'POST /analyze-scene',
            'POST /analyze-persons',
            'POST /analyze-threat',
            'GET /health',
            'GET /status',
        ],
        'cache': {
            'type': 'memory',
            'connected': True
        }
    })


@system_bp.route('/status')
def status():
    return jsonify({
        'status': 'ready',
        'initialized': state.detector.initialized,
        'service': 'opencv-detection',
        'detectionMode': 'yolo',
        'classNames': len(state.class_names)
    })
