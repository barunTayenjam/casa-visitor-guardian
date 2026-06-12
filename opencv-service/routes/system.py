from flask import Blueprint, jsonify
from datetime import datetime
import os

import state

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
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'service': 'opencv-detection',
        'version': os.getenv('SERVICE_VERSION', '1.0.0'),
        'detectionMode': 'yolo',
        'model': {
            'type': 'YOLO',
            'initialized': state.detector.initialized,
            'classCount': len(state.class_names)
        },
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
