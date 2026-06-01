import cv2
import numpy as np
import os
import json
import time
import threading
from typing import List, Dict, Any, Optional
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor, Json
import redis

import state
from utils import MODELS_DIR, load_class_names


class DetectionCache:
    def __init__(self):
        self.db_host = os.getenv('POSTGRES_HOST', 'postgres')
        self.db_port = os.getenv('POSTGRES_PORT', '5432')
        self.db_name = os.getenv('POSTGRES_DB', 'sentryvision')
        self.db_user = os.getenv('POSTGRES_USER', 'sentryvision')
        self.db_password = os.environ.get('POSTGRES_PASSWORD')
        if not self.db_password:
            raise ValueError('POSTGRES_PASSWORD environment variable is required')
        self.cache_ttl = 300

        self.connection_pool = None
        self._initialize_pool()
        self._cleanup_old_cache()

    def _initialize_pool(self):
        try:
            self.connection_pool = pool.SimpleConnectionPool(
                minconn=1,
                maxconn=5,
                host=self.db_host,
                port=self.db_port,
                database=self.db_name,
                user=self.db_user,
                password=self.db_password
            )
            print(f"DetectionCache: PostgreSQL connection pool initialized")
        except Exception as e:
            print(f"DetectionCache: Failed to initialize PostgreSQL pool: {e}")

    def _get_connection(self):
        if not self.connection_pool or self.connection_pool.closed:
            self._initialize_pool()
        if self.connection_pool:
            return self.connection_pool.getconn()
        raise Exception("Failed to get database connection")

    def _return_connection(self, conn):
        if self.connection_pool and not self.connection_pool.closed:
            self.connection_pool.putconn(conn)

    def _cleanup_old_cache(self):
        try:
            conn = self._get_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        DELETE FROM detection_cache
                        WHERE updated_at < NOW() - INTERVAL %s
                    """, (f'{self.cache_ttl} seconds',))
                    deleted = cur.rowcount
                    conn.commit()
                    if deleted > 0:
                        print(f"DetectionCache: Cleaned up {deleted} old cache entries")
            finally:
                self._return_connection(conn)
        except Exception as e:
            print(f"DetectionCache: Cleanup error: {e}")

    def get(self, file_hash: str) -> Optional[Dict]:
        try:
            conn = self._get_connection()
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("""
                        SELECT file_hash, object_detections, face_detections, processing_time
                        FROM detection_cache
                        WHERE file_hash = %s AND updated_at > NOW() - INTERVAL %s
                    """, (file_hash, f'{self.cache_ttl} seconds'))
                    row = cur.fetchone()
                    if row:
                        return {
                            'file_hash': row['file_hash'],
                            'object_detections': row['object_detections'],
                            'face_detections': row['face_detections'],
                            'processing_time': row['processing_time']
                        }
                    return None
            finally:
                self._return_connection(conn)
        except Exception as e:
            print(f"DetectionCache: Failed to get cache entry: {e}")
            return None

    def set(self, file_hash: str, object_detections: List, face_detections: List, processing_time: float, file_path: str, file_size: int, file_modified: str):
        try:
            conn = self._get_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO detection_cache
                        (file_hash, file_path, file_size, file_modified, object_detections, face_detections, processing_time)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (file_hash) DO UPDATE
                        SET object_detections = EXCLUDED.object_detections,
                            face_detections = EXCLUDED.face_detections,
                            processing_time = EXCLUDED.processing_time,
                            updated_at = CURRENT_TIMESTAMP
                    """, (file_hash, file_path, file_size, file_modified, Json(object_detections), Json(face_detections), processing_time))
                    conn.commit()
                    print(f"DetectionCache: Cached result for {file_hash}")
            finally:
                self._return_connection(conn)
        except Exception as e:
            print(f"DetectionCache: Failed to save cache entry: {e}")

    def cleanup(self):
        self._cleanup_old_cache()


class RedisDetectionCache:
    def __init__(self):
        self.ttl = 300

    def get(self, file_hash: str) -> Optional[Dict]:
        try:
            data = state.redis_client.get(f'detection:{file_hash}')
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            print(f"Redis cache get error: {e}")
            return None

    def set(self, file_hash: str, object_detections: List, face_detections: List, processing_time: float):
        try:
            data = {
                'file_hash': file_hash,
                'object_detections': object_detections,
                'face_detections': face_detections,
                'processing_time': processing_time,
                'timestamp': time.time()
            }
            state.redis_client.setex(f'detection:{file_hash}', self.ttl, json.dumps(data))
        except Exception as e:
            print(f"Redis cache set error: {e}")


class YOLOObjectDetector:
    def __init__(self):
        self.initialized = False
        self.net = None
        self.layer_names = None
        self.input_size = 640
        self.confidence_threshold = 0.30
        self.nms_threshold = 0.45
        self.model_type = None

        self.dnn_face_detector = None

        self.class_thresholds = {
            'person': 0.30,
            'car': 0.50,
            'truck': 0.70,
            'bus': 0.50,
            'motorcycle': 0.50,
            'bicycle': 0.50,
            'dog': 0.35,
            'cat': 0.35,
            'bird': 0.30,
            'horse': 0.40,
            'sheep': 0.30,
            'cow': 0.30,
            'elephant': 0.30,
            'bear': 0.30,
            'zebra': 0.30,
            'giraffe': 0.30,
            'backpack': 0.30,
            'umbrella': 0.50,
            'handbag': 0.50,
            'tie': 0.50,
            'suitcase': 0.50,
            'frisbee': 0.50,
            'skis': 0.50,
            'snowboard': 0.50,
            'sports ball': 0.50,
            'kite': 0.50,
            'baseball bat': 0.50,
            'baseball glove': 0.50,
            'skateboard': 0.50,
            'surfboard': 0.50,
            'tennis racket': 0.50,
            'bottle': 0.65,
            'wine glass': 0.65,
            'cup': 0.65,
            'fork': 0.65,
            'knife': 0.65,
            'spoon': 0.65,
            'bowl': 0.65,
            'banana': 0.65,
            'apple': 0.65,
            'sandwich': 0.65,
            'orange': 0.65,
            'broccoli': 0.65,
            'carrot': 0.65,
            'hot dog': 0.65,
            'pizza': 0.65,
            'donut': 0.65,
            'cake': 0.65,
            'chair': 0.60,
            'couch': 0.60,
            'potted plant': 0.65,
            'bed': 0.60,
            'dining table': 0.60,
            'toilet': 0.60,
            'tv': 0.60,
            'laptop': 0.60,
            'mouse': 0.60,
            'remote': 0.60,
            'keyboard': 0.60,
            'cell phone': 0.60,
            'microwave': 0.60,
            'oven': 0.60,
            'toaster': 0.60,
            'sink': 0.60,
            'refrigerator': 0.60,
            'book': 0.60,
            'clock': 0.60,
            'vase': 0.45,
            'scissors': 0.45,
            'teddy bear': 0.45,
            'hair drier': 0.45,
            'toothbrush': 0.45,
        }

        self.min_box_area = 2500
        self.min_box_width = 50
        self.min_box_height = 50

    def initialize(self):
        if self.initialized:
            return

        try:
            yolov8_path = os.path.join(MODELS_DIR, 'yolov8n.onnx')

            if os.path.exists(yolov8_path):
                print(f"OpenCV Service: Loading YOLOv8n ONNX model from {yolov8_path}")
                self.net = cv2.dnn.readNet(yolov8_path)
                self.model_type = 'yolov8'

                try:
                    if cv2.cuda.getCudaEnabledDeviceCount() > 0:
                        self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_CUDA)
                        self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA)
                        print("OpenCV Service: Using YOLOv8n with CUDA")
                    else:
                        raise RuntimeError("No CUDA devices")
                except Exception:
                    self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                    self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                    print("OpenCV Service: Using YOLOv8n with CPU")

                self.initialized = True
                print("OpenCV Service: YOLOv8n detection initialized successfully")
                return

            yolov5_path = os.path.join(MODELS_DIR, 'yolov5n.onnx')

            if os.path.exists(yolov5_path):
                print(f"OpenCV Service: Loading YOLOv5n ONNX model from {yolov5_path}")
                self.net = cv2.dnn.readNet(yolov5_path)
                self.model_type = 'yolov5'

                try:
                    if cv2.cuda.getCudaEnabledDeviceCount() > 0:
                        self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_CUDA)
                        self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA)
                        print("OpenCV Service: Using YOLOv5n with CUDA")
                    else:
                        raise RuntimeError("No CUDA devices")
                except Exception:
                    self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                    self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                    print("OpenCV Service: Using YOLOv5n with CPU")

                self.initialized = True
                print("OpenCV Service: YOLOv5n detection initialized successfully")
                return

            weights_path = os.path.join(MODELS_DIR, 'yolov4-tiny.weights')
            config_path = os.path.join(MODELS_DIR, 'yolov4-tiny.cfg')

            if os.path.exists(weights_path) and os.path.exists(config_path):
                print(f"OpenCV Service: Loading YOLOv4-tiny model from {weights_path}")
                self.net = cv2.dnn.readNet(weights_path, config_path)
                self.model_type = 'yolov4'

                try:
                    self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_CUDA)
                    self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA)
                    print("OpenCV Service: Using CUDA GPU acceleration")
                except:
                    self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                    self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                    print("OpenCV Service: Using CPU with OpenCV optimization")

                self.layer_names = self.net.getLayerNames()
                self.layer_names = [self.layer_names[i - 1] for i in self.net.getUnconnectedOutLayers()]

                print(f"OpenCV Service: YOLOv4-tiny loaded successfully with {len(self.layer_names)} output layers")
            else:
                print("YOLO models not found, will use fallback detection")
                self.initialized = True
                return

            self.initialized = True
            print("OpenCV Service: YOLO detection initialized successfully")

        except Exception as e:
            print(f"OpenCV Service: Failed to initialize YOLO: {e}")
            self.initialized = True

    def _get_class_threshold(self, class_name: str) -> float:
        return self.class_thresholds.get(class_name, self.confidence_threshold)

    def _is_valid_box(self, x: int, y: int, w: int, h: int) -> bool:
        box_area = w * h
        return (w >= self.min_box_width and
                h >= self.min_box_height and
                box_area >= self.min_box_area)

    def detect_objects(self, image_path: str, file_hash: str, file_path: str = '', file_size: int = 0, file_modified: str = '') -> Dict[str, Any]:
        start_time = time.time()

        try:
            cached = state.redis_cache.get(file_hash)
            if cached:
                print(f"OpenCV Service: Using Redis cached result for {file_hash}")
                return {
                    'success': True,
                    'cached': True,
                    'detections': cached['object_detections'],
                    'processingTime': cached['processing_time'],
                    'fileHash': file_hash
                }

            if not os.path.exists(image_path):
                raise FileNotFoundError(f"Image not found: {image_path}")

            image = cv2.imread(image_path)
            if image is None:
                raise ValueError("Failed to read image")

            detections = self._perform_yolo_detection(image)

            processing_time = (time.time() - start_time) * 1000

            state.redis_cache.set(file_hash, detections, [], processing_time)

            return {
                'success': True,
                'cached': False,
                'detections': detections,
                'processingTime': processing_time,
                'fileHash': file_hash
            }

        except Exception as e:
            print(f"OpenCV Service: Detection failed: {e}")
            return {
                'success': False,
                'cached': False,
                'fileHash': file_hash,
                'error': str(e)
            }

    def _perform_yolo_detection(self, image: np.ndarray) -> List[Dict[str, Any]]:
        detections = []

        try:
            height, width = image.shape[:2]

            if self.net is not None:
                blob = cv2.dnn.blobFromImage(
                    image,
                    1/255.0,
                    (self.input_size, self.input_size),
                    swapRB=True,
                    crop=False
                )
                self.net.setInput(blob)

                try:
                    outputs = self.net.forward(self.layer_names) if self.layer_names else self.net.forward()
                except cv2.error as e:
                    if 'CUDA' in str(e) or 'cuda' in str(e):
                        print("OpenCV Service: CUDA inference failed, switching to CPU")
                        self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                        self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                        outputs = self.net.forward(self.layer_names) if self.layer_names else self.net.forward()
                    else:
                        raise e

                boxes = []
                confidences = []
                class_ids = []

                if self.model_type == 'yolov8':
                    output = outputs[0]

                    if output.shape[0] != 1 and output.shape[0] != 8400:
                        output = output.T

                    if len(output.shape) == 3 and output.shape[0] == 1:
                        output = output[0]

                    num_detections, num_cols = output.shape

                    for detection in output:
                        class_scores = detection[4:]
                        class_id = int(np.argmax(class_scores))
                        class_conf = float(class_scores[class_id])

                        class_name = state.class_names[class_id] if class_id < len(state.class_names) else f"object_{class_id}"
                        class_threshold = self._get_class_threshold(class_name)

                        confidence = class_conf

                        if confidence > class_threshold:
                            x_center = float(detection[0])
                            y_center = float(detection[1])
                            box_w = float(detection[2])
                            box_h = float(detection[3])

                            x = int((x_center - box_w / 2) * width)
                            y = int((y_center - box_h / 2) * height)
                            box_w = int(box_w * width)
                            box_h = int(box_h * height)

                            x = max(0, x)
                            y = max(0, y)
                            box_w = min(width - x, box_w)
                            box_h = min(height - y, box_h)

                            if self._is_valid_box(x, y, box_w, box_h):
                                boxes.append([x, y, box_w, box_h])
                                confidences.append(float(confidence))
                                class_ids.append(int(class_id))
                elif self.model_type == 'yolov5':
                    output = outputs[0]

                    if output.shape[0] != 25200 and output.shape[0] != 1:
                        output = output.T

                    if len(output.shape) == 3 and output.shape[0] == 1:
                        output = output[0]

                    for detection in output:
                        x, y, w, h = detection[0:4]
                        obj_conf = float(detection[4])

                        class_scores = detection[5:]
                        class_id = int(np.argmax(class_scores))
                        class_conf = float(class_scores[class_id])

                        confidence = obj_conf * class_conf

                        class_name = state.class_names[class_id] if class_id < len(state.class_names) else f"object_{class_id}"
                        class_threshold = self._get_class_threshold(class_name)

                        if confidence > class_threshold:
                            center_x = float(x)
                            center_y = float(y)
                            box_w = float(w)
                            box_h = float(h)

                            scale_x = width / self.input_size
                            scale_y = height / self.input_size

                            x = int((center_x - box_w / 2) * scale_x)
                            y = int((center_y - box_h / 2) * scale_y)
                            box_w = int(box_w * scale_x)
                            box_h = int(box_h * scale_y)

                            x = max(0, x)
                            y = max(0, y)
                            box_w = min(width - x, box_w)
                            box_h = min(height - y, box_h)

                            if self._is_valid_box(x, y, box_w, box_h):
                                boxes.append([x, y, box_w, box_h])
                                confidences.append(float(confidence))
                                class_ids.append(int(class_id))
                else:
                    for output in outputs:
                        for detection in output:
                            obj_conf = float(detection[4])
                            scores = detection[5:]
                            class_id = np.argmax(scores)
                            class_conf = float(scores[class_id])

                            confidence = obj_conf * class_conf

                            class_name = state.class_names[class_id] if class_id < len(state.class_names) else f"object_{class_id}"
                            class_threshold = self._get_class_threshold(class_name)

                            if confidence > class_threshold:
                                center_x = int(detection[0] * width)
                                center_y = int(detection[1] * height)
                                w = int(detection[2] * width)
                                h = int(detection[3] * height)

                                x = int(center_x - w / 2)
                                y = int(center_y - h / 2)

                                x = max(0, x)
                                y = max(0, y)
                                w = min(width - x, w)
                                h = min(height - y, h)

                                if self._is_valid_box(x, y, w, h):
                                    boxes.append([x, y, w, h])
                                    confidences.append(float(confidence))
                                    class_ids.append(int(class_id))

                max_detections = 50
                indices = cv2.dnn.NMSBoxes(boxes, confidences, self.confidence_threshold, self.nms_threshold)

                if len(indices) > 0:
                    for i in indices.flatten()[:max_detections]:
                        x, y, w, h = boxes[i]
                        class_id = class_ids[i]
                        confidence = confidences[i]

                        class_name = state.class_names[class_id] if class_id < len(state.class_names) else f"object_{class_id}"

                        detections.append({
                            'class': class_name,
                            'confidence': round(min(100, confidence * 100), 2),
                            'bbox': {
                                'x': max(0, int(x)),
                                'y': max(0, int(y)),
                                'width': int(w),
                                'height': int(h)
                            }
                        })

                classes_found = [d['class'] for d in detections]
                print(f"OpenCV Service: Detected {len(detections)} objects: {classes_found}")
            else:
                detections = self._fallback_detection(image)

            return detections

        except Exception as e:
            print(f"OpenCV Service: YOLO detection error: {e}")
            return []

    def _fallback_detection(self, image: np.ndarray) -> List[Dict[str, Any]]:
        detections = []

        try:
            hog = cv2.HOGDescriptor()
            hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

            (rects, weights) = hog.detectMultiScale(
                image,
                winStride=(8, 8),
                padding=(32, 32),
                scale=1.05
            )

            for (x, y, w, h), weight in zip(rects, weights):
                detections.append({
                    'class': 'person',
                    'confidence': round(min(100, max(30, weight * 100)), 2),
                    'bbox': {
                        'x': int(x),
                        'y': int(y),
                        'width': int(w),
                        'height': int(h)
                    }
                })

            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

            for (x, y, w, h) in faces:
                detections.append({
                    'class': 'face',
                    'confidence': 80,
                    'bbox': {
                        'x': int(x),
                        'y': int(y),
                        'width': int(w),
                        'height': int(h)
                    }
                })

        except Exception as e:
            print(f"OpenCV Service: Fallback detection error: {e}")

        return detections

    def recognize_faces(self, image_path: str, file_hash: str, file_path: str = '', file_size: int = 0, file_modified: str = '') -> Dict[str, Any]:
        start_time = time.time()

        try:
            cached = state.redis_cache.get(file_hash)
            if cached:
                print(f"OpenCV Service: Using Redis cached result for {file_hash}")
                return {
                    'success': True,
                    'cached': True,
                    'faceDetections': cached['face_detections'],
                    'processingTime': cached['processing_time'],
                    'fileHash': file_hash
                }

            if not os.path.exists(image_path):
                raise FileNotFoundError(f"Image not found: {image_path}")

            image = cv2.imread(image_path)
            if image is None:
                raise ValueError("Failed to read image")

            face_detections = self._detect_faces(image)

            processing_time = (time.time() - start_time) * 1000

            state.redis_cache.set(file_hash, [], face_detections, processing_time)

            return {
                'success': True,
                'cached': False,
                'faceDetections': face_detections,
                'processingTime': processing_time,
                'fileHash': file_hash
            }

        except Exception as e:
            print(f"OpenCV Service: Face recognition failed: {e}")
            return {
                'success': False,
                'cached': False,
                'fileHash': file_hash,
                'error': str(e)
            }

    def _detect_faces(self, image: np.ndarray) -> List[Dict[str, Any]]:
        if state.face_recognition is None:
            return []
        try:
            return state.face_recognition._detect_faces(image)
        except Exception as e:
            print(f"OpenCV Service: Face detection error: {e}")
            return []


class MotionDetector:
    def __init__(self):
        self.initialized = False
        self.bg_subtractors = {}
        self.last_frames = {}

        self.use_mog2 = True

    def initialize(self):
        if self.initialized:
            return

        self.initialized = True
        print("OpenCV Service: Motion detection initialized")

    def _get_bg_subtractor(self, camera_id: str):
        if camera_id not in self.bg_subtractors:
            if self.use_mog2:
                bg_subtractor = cv2.createBackgroundSubtractorMOG2(
                    history=200,
                    varThreshold=8,
                    detectShadows=False
                )
            else:
                bg_subtractor = cv2.createBackgroundSubtractorKNN(
                    history=500,
                    dist2Threshold=400,
                    detectShadows=True
                )

            self.bg_subtractors[camera_id] = bg_subtractor

        return self.bg_subtractors[camera_id]

    def detect_motion(self, image: np.ndarray, camera_id: str = "default",
                     threshold: int = 500) -> Dict[str, Any]:
        if not self.initialized:
            self.initialize()

        try:
            bg_subtractor = self._get_bg_subtractor(camera_id)

            scale_factor = 1.0
            original_shape = image.shape[:2]
            if image.shape[0] > 640 or image.shape[1] > 640:
                scale_factor = 640.0 / max(image.shape[0], image.shape[1])
                image = cv2.resize(image, (0, 0), fx=scale_factor, fy=scale_factor)

            fg_mask = bg_subtractor.apply(image)

            _, fg_mask = cv2.threshold(fg_mask, 250, 255, cv2.THRESH_BINARY)

            kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel_open, iterations=1)

            kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel_close, iterations=1)

            kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            fg_mask = cv2.dilate(fg_mask, kernel_dilate, iterations=1)

            motion_pixels = cv2.countNonZero(fg_mask)
            total_pixels = fg_mask.shape[0] * fg_mask.shape[1]
            motion_percentage = (motion_pixels / total_pixels) * 100

            contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            min_contour_area = max(150, int((image.shape[0] * image.shape[1]) * 0.001))
            significant_contours = [c for c in contours if cv2.contourArea(c) > min_contour_area]

            total_contour_area = sum(cv2.contourArea(c) for c in significant_contours)
            contour_area_percentage = (total_contour_area / total_pixels) * 100

            motion_detected = (motion_percentage > 0.2) or (contour_area_percentage > 0.15)

            motion_regions = []
            for contour in significant_contours:
                x, y, w, h = cv2.boundingRect(contour)
                if scale_factor != 1.0:
                    x = int(x / scale_factor)
                    y = int(y / scale_factor)
                    w = int(w / scale_factor)
                    h = int(h / scale_factor)

                motion_regions.append({
                    'x': x,
                    'y': y,
                    'width': w,
                    'height': h,
                    'area': int(cv2.contourArea(contour))
                })

            motion_regions.sort(key=lambda r: r['area'], reverse=True)

            confidence = max(0, min(100, (motion_percentage * 8 + contour_area_percentage * 8)))

            result = {
                'motion_detected': motion_detected,
                'motion_percentage': round(motion_percentage, 2),
                'contour_area_percentage': round(contour_area_percentage, 2),
                'motion_pixel_count': int(motion_pixels),
                'contour_count': len(significant_contours),
                'motion_regions': motion_regions[:10],
                'confidence': round(confidence, 2)
            }

            return result

        except Exception as e:
            print(f"Motion detection error: {e}")
            return {
                'motion_detected': False,
                'error': str(e)
            }

    def detect_motion_with_images(self, frame1: np.ndarray, frame2: np.ndarray) -> Dict[str, Any]:
        try:
            if frame1.shape != frame2.shape:
                frame2 = cv2.resize(frame2, (frame1.shape[1], frame1.shape[0]))

            gray1 = cv2.cvtColor(frame1, cv2.COLOR_BGR2GRAY)
            gray2 = cv2.cvtColor(frame2, cv2.COLOR_BGR2GRAY)

            gray1 = cv2.GaussianBlur(gray1, (5, 5), 0)
            gray2 = cv2.GaussianBlur(gray2, (5, 5), 0)

            diff = cv2.absdiff(gray1, gray2)

            _, thresh = cv2.threshold(diff, 20, 255, cv2.THRESH_BINARY)

            kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel_open, iterations=2)

            kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
            thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel_close, iterations=2)

            kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            thresh = cv2.dilate(thresh, kernel_dilate, iterations=1)

            motion_pixels = cv2.countNonZero(thresh)
            total_pixels = thresh.shape[0] * thresh.shape[1]
            motion_percentage = (motion_pixels / total_pixels) * 100

            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            min_contour_area = max(150, int((thresh.shape[0] * thresh.shape[1]) * 0.001))
            significant_contours = [c for c in contours if cv2.contourArea(c) > min_contour_area]

            total_contour_area = sum(cv2.contourArea(c) for c in significant_contours)
            contour_area_percentage = (total_contour_area / total_pixels) * 100

            motion_detected = (motion_percentage > 0.3) or (contour_area_percentage > 0.2)

            confidence = max(0, min(100, (motion_percentage * 5 + contour_area_percentage * 5)))

            result = {
                'motion_detected': motion_detected,
                'motion_percentage': round(motion_percentage, 2),
                'contour_area_percentage': round(contour_area_percentage, 2),
                'motion_pixel_count': int(motion_pixels),
                'contour_count': len(significant_contours),
                'confidence': round(confidence, 2)
            }

            return result

        except Exception as e:
            print(f"Frame comparison motion detection error: {e}")
            return {
                'motion_detected': False,
                'error': str(e)
            }


def start_rtsp_service():
    if state._rtsp_service is not None:
        return
    try:
        from rtsp_ingestion import RTSPService, load_camera_config, FramePipeline
        config_path = os.environ.get('CAMERAS_CONFIG_PATH', '/app/cameras.json')
        cameras = load_camera_config(config_path)
        if cameras:
            state._rtsp_service = RTSPService(cameras)
            state._rtsp_service.start_non_blocking()

            def _face_rec_fn(face_roi):
                if state.face_recognition is None:
                    return ("unknown", 0.0)
                try:
                    return state.face_recognition.recognize_face(face_roi)
                except Exception:
                    return ("unknown", 0.0)

            for pipeline in state._rtsp_service._pipelines.values():
                pipeline.set_face_recognition(_face_rec_fn)

            print(f"[pipeline.py] RTSPService started with {len(cameras)} cameras")
        else:
            print("[pipeline.py] No cameras found, RTSPService not started")
    except Exception as e:
        import traceback
        print(f"[pipeline.py] Failed to start RTSPService: {e}")
        traceback.print_exc()


def initialize():
    state.class_names = load_class_names()

    if os.path.exists(MODELS_DIR):
        print(f"DEBUG: Files in {MODELS_DIR}: {os.listdir(MODELS_DIR)}")
    else:
        print(f"DEBUG: {MODELS_DIR} does not exist")

    state.redis_client = redis.Redis(
        host=os.getenv('REDIS_HOST', 'redis'),
        port=int(os.getenv('REDIS_PORT', 6379)),
        db=0,
        decode_responses=True,
        retry_on_timeout=True
    )

    state.redis_cache = RedisDetectionCache()

    try:
        state.db_cache = DetectionCache()
        cleanup_thread = threading.Thread(target=state.db_cache.cleanup, daemon=True)
        cleanup_thread.start()
    except Exception as e:
        print(f"DetectionCache initialization failed: {e}")

    try:
        from arcface_recognizer import ArcFaceRecognizer
        FaceRecognition = ArcFaceRecognizer
        print("OpenCV Service: Using ArcFace face recognition module")
    except ImportError as e:
        print(f"OpenCV Service: ArcFace not available ({e}), trying improved module")
        try:
            from improved_face_recognition import ImprovedFaceRecognition
            FaceRecognition = ImprovedFaceRecognition
            print("OpenCV Service: Using improved face recognition module (fallback)")
        except ImportError:
            print("OpenCV Service: No face recognition module available — running without face recognition")
            FaceRecognition = None

    state.face_recognition = FaceRecognition() if FaceRecognition is not None else None

    detector = YOLOObjectDetector()
    detector.initialize()
    state.detector = detector

    motion_detector = MotionDetector()
    motion_detector.initialize()
    state.motion_detector = motion_detector
