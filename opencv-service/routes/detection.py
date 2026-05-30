from flask import Blueprint, request, jsonify, Response
import cv2
import numpy as np
import os
import hashlib
import time
import tempfile

import state
from utils import draw_detections

detection_bp = Blueprint('detection', __name__)


@detection_bp.route('/detect-motion', methods=['POST'])
def detect_motion_route():
    try:
        if 'image1' in request.files and 'image2' in request.files:
            image_file1 = request.files['image1']
            image_file2 = request.files['image2']

            image1 = cv2.imdecode(np.frombuffer(image_file1.read(), np.uint8), cv2.IMREAD_COLOR)
            image2 = cv2.imdecode(np.frombuffer(image_file2.read(), np.uint8), cv2.IMREAD_COLOR)

            if image1 is None or image2 is None:
                return jsonify({'success': False, 'error': 'Failed to decode images'}), 400

            result = state.motion_detector.detect_motion_with_images(image1, image2)

        elif 'image' in request.files:
            image_file = request.files['image']
            camera_id = request.form.get('cameraId', 'default')

            image = cv2.imdecode(np.frombuffer(image_file.read(), np.uint8), cv2.IMREAD_COLOR)

            if image is None:
                return jsonify({'success': False, 'error': 'Failed to decode image'}), 400

            result = state.motion_detector.detect_motion(image, camera_id)

        elif request.data:
            image = cv2.imdecode(np.frombuffer(request.data, np.uint8), cv2.IMREAD_COLOR)
            camera_id = request.form.get('cameraId', 'default')

            if image is None:
                return jsonify({'success': False, 'error': 'Failed to decode image'}), 400

            result = state.motion_detector.detect_motion(image, camera_id)
        else:
            return jsonify({'success': False, 'error': 'No image provided'}), 400

        print(f"OpenCV Service: Motion detection - detected={result.get('motion_detected')}, confidence={result.get('confidence', 0)}%")

        return jsonify({
            'success': True,
            'motion_detected': result.get('motion_detected', False),
            'confidence': result.get('confidence', 0),
            'motion_percentage': result.get('motion_percentage', 0),
            'motion_regions': result.get('motion_regions', []),
            'contour_count': result.get('contour_count', 0),
            'motion_pixel_count': result.get('motion_pixel_count', 0)
        })

    except Exception as e:
        print(f"OpenCV Service: Motion detection error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@detection_bp.route('/detect-objects', methods=['POST'])
def detect_objects_route():
    try:
        if 'image' not in request.files and not request.data:
            return jsonify({'success': False, 'error': 'No image file or data provided'}), 400

        if request.files.get('image'):
            image_file = request.files['image']
            file_hash = request.form.get('fileHash', hashlib.md5(image_file.read()).hexdigest())
            image_file.seek(0)

            image_data = np.frombuffer(image_file.read(), np.uint8)
            image = cv2.imdecode(image_data, cv2.IMREAD_COLOR)
        else:
            image_data = np.frombuffer(request.data, np.uint8)
            image = cv2.imdecode(image_data, cv2.IMREAD_COLOR)
            file_hash = request.form.get('fileHash', hashlib.md5(request.data).hexdigest())

        if image is None:
            return jsonify({'success': False, 'error': 'Failed to decode image'}), 400

        print(f"OpenCV Service: Object detection request for {file_hash}")

        detections = state.detector._perform_yolo_detection(image)

        return jsonify({
            'success': True,
            'detections': detections,
            'fileHash': file_hash
        })

    except Exception as e:
        print(f"OpenCV Service: Object detection error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@detection_bp.route('/detect-and-draw', methods=['POST'])
def detect_and_draw_route():
    try:
        if 'image' not in request.files and not request.data:
            return jsonify({'success': False, 'error': 'No image file or data provided'}), 400

        if request.files.get('image'):
            image_file = request.files['image']
            image_data = np.frombuffer(image_file.read(), np.uint8)
            image = cv2.imdecode(image_data, cv2.IMREAD_COLOR)
        else:
            image_data = np.frombuffer(request.data, np.uint8)
            image = cv2.imdecode(image_data, cv2.IMREAD_COLOR)

        if image is None:
            return jsonify({'success': False, 'error': 'Failed to decode image'}), 400

        detections = state.detector._perform_yolo_detection(image)

        annotated_image = draw_detections(image, detections)

        _, buffer = cv2.imencode('.jpg', annotated_image, [cv2.IMWRITE_JPEG_QUALITY, 85])

        return Response(
            buffer.tobytes(),
            mimetype='image/jpeg',
            headers={'X-Detection-Count': str(len(detections))}
        )

    except Exception as e:
        print(f"OpenCV Service: Detect and draw error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@detection_bp.route('/annotate-by-path', methods=['POST'])
def annotate_by_path_route():
    try:
        data = request.get_json(force=True)
        if not data or 'path' not in data:
            return jsonify({'success': False, 'error': 'No path provided'}), 400

        filepath = data['path']
        if not os.path.exists(filepath):
            return jsonify({'success': False, 'error': f'File not found: {filepath}'}), 404

        image = cv2.imread(filepath)
        if image is None:
            return jsonify({'success': False, 'error': 'Failed to read image'}), 400

        detections = state.detector._perform_yolo_detection(image)
        annotated_image = draw_detections(image, detections)

        _, buffer = cv2.imencode('.jpg', annotated_image, [cv2.IMWRITE_JPEG_QUALITY, 85])

        return Response(
            buffer.tobytes(),
            mimetype='image/jpeg',
            headers={'X-Detection-Count': str(len(detections))}
        )

    except Exception as e:
        print(f"OpenCV Service: Annotate by path error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@detection_bp.route('/recognize-faces', methods=['POST'])
def recognize_faces_route():
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file provided'}), 400

        image_file = request.files['image']
        file_hash = request.form.get('fileHash', '')
        file_size = request.form.get('fileSize', 0, type=int)
        file_modified = request.form.get('fileModified', '')

        temp_image_path = os.path.join(tempfile.gettempdir(), f'face_{file_hash}.jpg')
        image_file.save(temp_image_path)

        print(f"OpenCV Service: Face recognition request for {file_hash}")

        result = state.detector.recognize_faces(temp_image_path, file_hash, '', file_size, file_modified)

        if os.path.exists(temp_image_path):
            os.unlink(temp_image_path)

        return jsonify(result)

    except Exception as e:
        print(f"OpenCV Service: Face recognition error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@detection_bp.route('/detect-batch', methods=['POST'])
def detect_batch():
    start_time = time.time()

    try:
        if 'images' not in request.files:
            return jsonify({'success': False, 'error': 'No images provided'}), 400

        images = request.files.getlist('images')
        batch_hash = request.form.get('batchHash', '')

        print(f"OpenCV Service: Batch detection request with {len(images)} images, batchHash: {batch_hash}")

        results = []
        total_processing_time = 0

        for image_file in images:
            file_hash = hashlib.md5(image_file.read()).hexdigest()
            image_file.seek(0)

            temp_image_path = os.path.join(tempfile.gettempdir(), f'batch_{file_hash}.jpg')
            image_file.save(temp_image_path)

            try:
                result = state.detector.detect_objects(temp_image_path, file_hash, '', 0, '')
                results.append({
                    'fileHash': file_hash,
                    'success': result.get('success', False),
                    'cached': result.get('cached', False),
                    'detections': result.get('detections', []),
                    'processingTime': result.get('processingTime', 0)
                })
                total_processing_time += result.get('processingTime', 0)
            except Exception as e:
                print(f"OpenCV Service: Error processing {file_hash}: {e}")
                results.append({
                    'fileHash': file_hash,
                    'success': False,
                    'error': str(e)
                })
            finally:
                if os.path.exists(temp_image_path):
                    os.unlink(temp_image_path)

        total_time = (time.time() - start_time) * 1000

        return jsonify({
            'success': True,
            'batchHash': batch_hash,
            'totalImages': len(images),
            'results': results,
            'totalProcessingTime': total_time,
            'averageProcessingTime': total_processing_time / len(images) if images else 0
        })

    except Exception as e:
        print(f"OpenCV Service: Batch detection error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@detection_bp.route('/detect-batch-paths', methods=['POST'])
def detect_batch_paths():
    start_time = time.time()

    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data provided'}), 400

        image_paths = data.get('imagePaths', [])
        batch_hash = data.get('batchHash', f'batch_{int(time.time())}')

        if not image_paths:
            return jsonify({'success': False, 'error': 'No image paths provided'}), 400

        print(f"OpenCV Service: Batch detection request with {len(image_paths)} file paths, batchHash: {batch_hash}")

        results = []
        total_processing_time = 0
        successful = 0
        failed = 0

        for image_path in image_paths:
            file_hash = hashlib.md5(image_path.encode()).hexdigest()

            if not os.path.exists(image_path):
                print(f"OpenCV Service: File not found: {image_path}")
                results.append({
                    'imagePath': image_path,
                    'fileHash': file_hash,
                    'success': False,
                    'error': 'File not found'
                })
                failed += 1
                continue

            try:
                result = state.detector.detect_objects(image_path, file_hash, '', 0, '')

                results.append({
                    'imagePath': image_path,
                    'fileHash': file_hash,
                    'success': result.get('success', False),
                    'cached': result.get('cached', False),
                    'detections': result.get('detections', []),
                    'processingTime': result.get('processingTime', 0)
                })

                total_processing_time += result.get('processingTime', 0)
                if result.get('success'):
                    successful += 1
                else:
                    failed += 1

            except Exception as e:
                print(f"OpenCV Service: Error processing {image_path}: {e}")
                results.append({
                    'imagePath': image_path,
                    'fileHash': file_hash,
                    'success': False,
                    'error': str(e)
                })
                failed += 1

        total_time = (time.time() - start_time) * 1000

        print(f"OpenCV Service: Batch detection completed - {successful} successful, {failed} failed, {total_time:.0f}ms total")

        return jsonify({
            'success': True,
            'batchHash': batch_hash,
            'totalImages': len(image_paths),
            'successful': successful,
            'failed': failed,
            'results': results,
            'totalProcessingTime': total_time,
            'averageProcessingTime': total_processing_time / len(image_paths) if image_paths else 0
        })

    except Exception as e:
        print(f"OpenCV Service: Batch detection error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
