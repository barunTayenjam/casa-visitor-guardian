import os

from flask import Blueprint, jsonify, request

from relation_analyzer import RelationAnalyzer, merge_scene_boxes
from scene_detector import SceneDetector

relations_bp = Blueprint('relations', __name__)

DETECTIONS_ROOT = os.path.abspath(os.environ.get('DETECTIONS_DIR', '/app/data/detections'))


@relations_bp.post('/analyze-relations')
def analyze_relations():
    payload = request.get_json(silent=True) or {}
    image_path = payload.get('image_path', '')
    detections = payload.get('detections', [])
    use_scene = bool(payload.get('scene'))

    if not image_path or not isinstance(detections, list):
        return jsonify({'error': 'image_path and detections are required'}), 400

    abs_path = os.path.abspath(image_path)
    if not abs_path.startswith(DETECTIONS_ROOT + os.sep):
        return jsonify({'error': 'image_path outside detections directory'}), 400
    if not os.path.isfile(abs_path):
        return jsonify({'error': 'image not found'}), 404

    if not RelationAnalyzer.available():
        return jsonify({'error': 'relations model unavailable', 'detail': RelationAnalyzer.load_error()}), 503

    if use_scene and len([d for d in detections if isinstance(d, dict) and d.get('bbox')]) < 2:
        if not SceneDetector.available():
            return jsonify({'error': 'scene detector unavailable', 'detail': SceneDetector.load_error()}), 503
        scene_boxes = SceneDetector.detect(abs_path)
        merged = merge_scene_boxes(detections, scene_boxes)
        detections = [
            {
                'bbox': {'x': b['x'], 'y': b['y'], 'width': b['width'], 'height': b['height']},
                'class': b.get('class') or 'object',
            }
            for b in merged
        ]

    result = RelationAnalyzer.analyze(abs_path, detections)
    return jsonify(result), 200
