#!/usr/bin/env python3
"""
OpenCV Detection Service - Python Implementation
Uses native OpenCV with YOLO for real object detection
"""

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import cv2
import numpy as np
import os
import json
import hashlib
import time
import tempfile
from datetime import datetime
from typing import List, Dict, Any, Optional
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor, Json
import pickle
import redis

import threading

app = Flask(__name__)
CORS(app)

# Configuration
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
CACHE_DIR = os.path.join(os.path.dirname(__file__), 'data', 'cache')
PORT = 8084

# Debug: List files in models directory
try:
    if os.path.exists(MODELS_DIR):
        print(f"DEBUG: Files in {MODELS_DIR}: {os.listdir(MODELS_DIR)}")
    else:
        print(f"DEBUG: {MODELS_DIR} does not exist")
except Exception as e:
    print(f"DEBUG: Error listing {MODELS_DIR}: {e}")

# Load COCO class names
def load_class_names():
    try:
        coco_path = os.path.join(MODELS_DIR, 'yolo_classes.txt')
        coco_names_path = os.path.join(MODELS_DIR, 'coco.names')
        
        if os.path.exists(coco_path):
            print(f"Loading class names from {coco_path}")
            with open(coco_path, 'r') as f:
                return f.read().strip().split('\n')
        elif os.path.exists(coco_names_path):
            print(f"Loading class names from {coco_names_path}")
            with open(coco_names_path, 'r') as f:
                return f.read().strip().split('\n')
        else:
            print(f"Warning: neither yolo_classes.txt nor coco.names found in {MODELS_DIR}, using defaults")
            return ['person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat']
    except Exception as e:
        print(f"Warning: Failed to load class names: {e}, using defaults")
        return ['person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat']

class_names = load_class_names()

# PostgreSQL-based cache
class DetectionCache:
    def __init__(self):
        self.db_host = os.getenv('POSTGRES_HOST', 'postgres')
        self.db_port = os.getenv('POSTGRES_PORT', '5432')
        self.db_name = os.getenv('POSTGRES_DB', 'sentryvision')
        self.db_user = os.getenv('POSTGRES_USER', 'sentryvision')
        self.db_password = os.environ.get('POSTGRES_PASSWORD')
        if not self.db_password:
            raise ValueError('POSTGRES_PASSWORD environment variable is required')
        self.cache_ttl = 300  # 5 minutes
        
        # Initialize connection pool
        self.connection_pool = None
        self._initialize_pool()
        self._cleanup_old_cache()

    def _initialize_pool(self):
        """Initialize PostgreSQL connection pool"""
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
        """Get a connection from the pool"""
        if not self.connection_pool or self.connection_pool.closed:
            self._initialize_pool()
        if self.connection_pool:
            return self.connection_pool.getconn()
        raise Exception("Failed to get database connection")

    def _return_connection(self, conn):
        """Return a connection to the pool"""
        if self.connection_pool and not self.connection_pool.closed:
            self.connection_pool.putconn(conn)

    def _cleanup_old_cache(self):
        """Remove old cache entries from database"""
        try:
            conn = self._get_connection()
            try:
                with conn.cursor() as cur:
                    # Use parameterized INTERVAL: pass full interval string as parameter
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
        """Get cached detection from PostgreSQL"""
        try:
            conn = self._get_connection()
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    # Use parameterized INTERVAL: pass full interval string as parameter
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
        """Cache detection result in PostgreSQL"""
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
        """Periodic cleanup of old cache entries"""
        self._cleanup_old_cache()

# Initialize Redis
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'redis'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    db=0,
    decode_responses=True,
    retry_on_timeout=True
)

class RedisDetectionCache:
    def __init__(self):
        self.ttl = 300  # 5 minutes

    def get(self, file_hash: str) -> Optional[Dict]:
        try:
            data = redis_client.get(f'detection:{file_hash}')
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
            redis_client.setex(f'detection:{file_hash}', self.ttl, json.dumps(data))
        except Exception as e:
            print(f"Redis cache set error: {e}")

# Initialize caches
redis_cache = RedisDetectionCache()
db_cache = DetectionCache()

# Enable automatic cleanup (SQL syntax fixed)
cleanup_thread = threading.Thread(target=db_cache.cleanup, daemon=True)
cleanup_thread.start()

class YOLOObjectDetector:
    """Object detection using YOLO model - Optimized for real-time detection"""

    def __init__(self):
        self.initialized = False
        self.net = None
        self.layer_names = None
        self.input_size = 640  # YOLOv5/YOLOv8 standard input size
        self.confidence_threshold = 0.55  # Increased from 0.5 for better accuracy
        self.nms_threshold = 0.30  # Lowered from 0.40 for more aggressive duplicate suppression
        self.model_type = None  # 'yolov8', 'yolov5' or 'yolov4'
        
        # DNN face detector for face recognition - init immediately
        try:
            prototxt_path = os.path.join(MODELS_DIR, 'deploy.prototxt')
            model_path = os.path.join(MODELS_DIR, 'res10_300x300_ssd_iter_140000_fp16.caffemodel')
            if os.path.exists(prototxt_path) and os.path.exists(model_path):
                self.dnn_face_detector = cv2.dnn.readNetFromCaffe(prototxt_path, model_path)
                print("OpenCV Service: DNN face detector loaded in __init__")
        except Exception as e:
            print(f"OpenCV Service: Failed to load DNN face detector in __init__: {e}")
            self.dnn_face_detector = None
        
        # Per-class confidence thresholds based on camera configuration
        # Increased all thresholds for better accuracy (reduces false positives)
        self.class_thresholds = {
            'person': 0.45,
            'car': 0.45,
            'truck': 0.45,
            'bus': 0.45,
            'motorcycle': 0.40,
            'bicycle': 0.40,
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
        
        # Minimum box area to filter out small detections (false positives)
        # Increased from 1500 to 4000 for better accuracy
        self.min_box_area = 4000  # Minimum area in pixels (was 1500)
        self.min_box_width = 40   # Minimum width in pixels (was 30)
        self.min_box_height = 40  # Minimum height in pixels (was 30)

    def initialize(self):
        """Initialize YOLO detector - prefers YOLOv8 for accuracy, falls back to YOLOv5/YOLOv4"""
        if self.initialized:
            return

        try:
            # Try YOLOv8n ONNX first (best modern accuracy)
            yolov8_path = os.path.join(MODELS_DIR, 'yolov8n.onnx')
            
            if os.path.exists(yolov8_path):
                print(f"OpenCV Service: Loading YOLOv8n ONNX model from {yolov8_path}")
                self.net = cv2.dnn.readNet(yolov8_path)
                self.model_type = 'yolov8'
                
                # CPU only for ONNX models (CUDA support limited)
                self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                print("OpenCV Service: Using YOLOv8n with CPU (ONNX format)")
                
                self.initialized = True
                print("OpenCV Service: YOLOv8n detection initialized successfully")
                return
            
            # Try YOLOv5n ONNX as fallback
            yolov5_path = os.path.join(MODELS_DIR, 'yolov5n.onnx')
            
            if os.path.exists(yolov5_path):
                print(f"OpenCV Service: Loading YOLOv5n ONNX model from {yolov5_path}")
                self.net = cv2.dnn.readNet(yolov5_path)
                self.model_type = 'yolov5'
                
                self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                print("OpenCV Service: Using YOLOv5n with CPU (ONNX format)")
                
            self.initialized = True
            print("OpenCV Service: YOLOv5n detection initialized successfully")
            return
            
            # Fall back to YOLOv4-tiny (if YOLOv8/YOLOv5 not available)
            weights_path = os.path.join(MODELS_DIR, 'yolov4-tiny.weights')
            config_path = os.path.join(MODELS_DIR, 'yolov4-tiny.cfg')
            
            if os.path.exists(weights_path) and os.path.exists(config_path):
                print(f"OpenCV Service: Loading YOLOv4-tiny model from {weights_path}")
                self.net = cv2.dnn.readNet(weights_path, config_path)
                self.model_type = 'yolov4'
                
                # Try to use GPU acceleration if available
                try:
                    self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_CUDA)
                    self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA)
                    print("OpenCV Service: Using CUDA GPU acceleration")
                except:
                    # Fall back to CPU optimization
                    self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                    self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                    print("OpenCV Service: Using CPU with OpenCV optimization")
                
                # Get output layer names
                self.layer_names = self.net.getLayerNames()
                self.layer_names = [self.layer_names[i - 1] for i in self.net.getUnconnectedOutLayers()]
                
                print(f"OpenCV Service: YOLOv4-tiny loaded successfully with {len(self.layer_names)} output layers")
            else:
                print("YOLO models not found, will use fallback detection")
                self.initialized = True
                return

            self.initialized = True
            print("OpenCV Service: YOLO detection initialized successfully")
            
            # Initialize DNN face detector
            prototxt_path = os.path.join(MODELS_DIR, 'deploy.prototxt')
            model_path = os.path.join(MODELS_DIR, 'res10_300x300_ssd_iter_140000_fp16.caffemodel')
            print(f"OpenCV Service: Checking DNN face detector: prototxt={os.path.exists(prototxt_path)}, model={os.path.exists(model_path)}")
            if os.path.exists(prototxt_path) and os.path.exists(model_path):
                self.dnn_face_detector = cv2.dnn.readNetFromCaffe(prototxt_path, model_path)
                print(f"OpenCV Service: DNN face detector loaded: {self.dnn_face_detector}")
            else:
                print("OpenCV Service: DNN face detector files not found")
            
        except Exception as e:
            print(f"OpenCV Service: Failed to initialize YOLO: {e}")
            # Fallback to basic detection
            self.initialized = True

    def _get_class_threshold(self, class_name: str) -> float:
        """Get confidence threshold for a specific class"""
        return self.class_thresholds.get(class_name, self.confidence_threshold)
    
    def _is_valid_box(self, x: int, y: int, w: int, h: int) -> bool:
        """Check if box meets minimum size requirements"""
        box_area = w * h
        return (w >= self.min_box_width and 
                h >= self.min_box_height and 
                box_area >= self.min_box_area)

    def detect_objects(self, image_path: str, file_hash: str, file_path: str = '', file_size: int = 0, file_modified: str = '') -> Dict[str, Any]:
        """Perform object detection using YOLO model"""
        start_time = time.time()

        try:
            # Check Redis cache first
            cached = redis_cache.get(file_hash)
            if cached:
                print(f"OpenCV Service: Using Redis cached result for {file_hash}")
                return {
                    'success': True,
                    'cached': True,
                    'detections': cached['object_detections'],
                    'processingTime': cached['processing_time'],
                    'fileHash': file_hash
                }

            # Check if image exists
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"Image not found: {image_path}")

            # Read image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError("Failed to read image")

            # Perform YOLO object detection
            detections = self._perform_yolo_detection(image)

            # Cleanup
            processing_time = (time.time() - start_time) * 1000

            # Cache in Redis
            redis_cache.set(file_hash, detections, [], processing_time)

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
        """Perform object detection using YOLO model (YOLOv5 or YOLOv4-tiny)"""
        detections = []

        try:
            height, width = image.shape[:2]

            # If we have a YOLO model loaded, use it
            if self.net is not None:
                # Create blob from image
                blob = cv2.dnn.blobFromImage(
                    image, 
                    1/255.0, 
                    (self.input_size, self.input_size), 
                    swapRB=True, 
                    crop=False
                )
                self.net.setInput(blob)

                # Run forward pass with CUDA fallback
                try:
                    outputs = self.net.forward(self.layer_names) if self.layer_names else self.net.forward()
                except cv2.error as e:
                    # CUDA failed, switch to CPU and retry
                    if 'CUDA' in str(e) or 'cuda' in str(e):
                        print("OpenCV Service: CUDA inference failed, switching to CPU")
                        self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                        self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                        outputs = self.net.forward(self.layer_names) if self.layer_names else self.net.forward()
                    else:
                        raise e

                # Process outputs based on model type
                boxes = []
                confidences = []
                class_ids = []

                if self.model_type == 'yolov8':
                    # YOLOv8 ONNX output: [1, 84, 8400] where 84 = 4 (box) + 80 (classes)
                    # Transpose to get shape: [8400, 84]
                    output = outputs[0]
                    
                    # Transpose if needed to get [num_detections, 4+classes]
                    if output.shape[0] != 1 and output.shape[0] != 8400:
                        output = output.T
                    
                    # Get first batch if shape is [1, num_detections, 4+classes]
                    if len(output.shape) == 3 and output.shape[0] == 1:
                        output = output[0]
                    
                    num_detections, num_cols = output.shape
                    
                    for detection in output:
                        # YOLOv8 format: [x_center, y_center, width, height, class_0, class_1, ..., class_79]
                        # Coordinates are NORMALIZED 0-1
                        # No object confidence - class scores only
                        
                        # Get class scores first to check threshold early
                        class_scores = detection[4:]
                        class_id = int(np.argmax(class_scores))
                        class_conf = float(class_scores[class_id])
                        
                        # Get class name and its specific threshold
                        class_name = class_names[class_id] if class_id < len(class_names) else f"object_{class_id}"
                        class_threshold = self._get_class_threshold(class_name)
                        
                        # YOLOv8 doesn't have separate object confidence, use class confidence
                        confidence = class_conf
                        
                        # Check against class-specific threshold
                        if confidence > class_threshold:
                            # Get box coordinates (normalized, center format)
                            x_center = float(detection[0])
                            y_center = float(detection[1])
                            box_w = float(detection[2])
                            box_h = float(detection[3])
                            
                            # Convert from center format to corner format
                            # Scale to original image size
                            x = int((x_center - box_w / 2) * width)
                            y = int((y_center - box_h / 2) * height)
                            box_w = int(box_w * width)
                            box_h = int(box_h * height)
                            
                            # Ensure box is within image bounds
                            x = max(0, x)
                            y = max(0, y)
                            box_w = min(width - x, box_w)
                            box_h = min(height - y, box_h)
                            
                            # Filter by box size to remove small false positives
                            if self._is_valid_box(x, y, box_w, box_h):
                                boxes.append([x, y, box_w, box_h])
                                confidences.append(float(confidence))
                                class_ids.append(int(class_id))
                elif self.model_type == 'yolov5':
                    # YOLOv5 ONNX output: [batch, num_anchors, 85] = [1, 25200, 85]
                    # Format: [x, y, w, h, obj_conf, class_0, class_1, ..., class_79]
                    # x, y, w, h are CENTER coordinates in PIXELS relative to input size (640x640)
                    output = outputs[0]  # Shape: (25200, 85)
                    
                    # Transpose to get [25200, 85]
                    if output.shape[0] != 25200 and output.shape[0] != 1:
                        output = output.T
                    
                    # Get the batch dimension
                    if len(output.shape) == 3 and output.shape[0] == 1:
                        output = output[0]  # Shape: (25200, 85)
                    
                    for detection in output:
                        # YOLOv5 format: [x, y, w, h, obj_conf, class_0, ...]
                        x, y, w, h = detection[0:4]
                        obj_conf = float(detection[4])
                        
                        # Get class scores (everything after obj_conf)
                        class_scores = detection[5:]
                        class_id = int(np.argmax(class_scores))
                        class_conf = float(class_scores[class_id])
                        
                        # Use class_conf directly for ONNX models
                        # ONNX-exported YOLOv5 objectness scores are unreliable (often ~0),
                        # but class scores remain well-calibrated
                        confidence = class_conf
                        
                        # Get class name and its specific threshold
                        class_name = class_names[class_id] if class_id < len(class_names) else f"object_{class_id}"
                        class_threshold = self._get_class_threshold(class_name)
                        
                        # Check against class-specific threshold
                        if confidence > class_threshold:
                            # Convert from center format to corner format
                            # x, y, w, h are in PIXEL coordinates relative to input size (640x640)
                            center_x = float(x)
                            center_y = float(y)
                            box_w = float(w)
                            box_h = float(h)
                            
                            # Scale to original image size
                            scale_x = width / self.input_size
                            scale_y = height / self.input_size
                            
                            x = int((center_x - box_w / 2) * scale_x)
                            y = int((center_y - box_h / 2) * scale_y)
                            box_w = int(box_w * scale_x)
                            box_h = int(box_h * scale_y)
                            
                            # Ensure box is within image bounds
                            x = max(0, x)
                            y = max(0, y)
                            box_w = min(width - x, box_w)
                            box_h = min(height - y, box_h)
                            
                            # Filter by box size to remove small false positives
                            if self._is_valid_box(x, y, box_w, box_h):
                                boxes.append([x, y, box_w, box_h])
                                confidences.append(float(confidence))
                                class_ids.append(int(class_id))
                else:
                    # YOLOv4-tiny output format: multiple layers, [cx, cy, w, h, obj, ...classes]
                    for output in outputs:
                        for detection in output:
                            scores = detection[5:]
                            class_id = np.argmax(scores)
                            confidence = scores[class_id]
                            
                            # Get class name and its specific threshold
                            class_name = class_names[class_id] if class_id < len(class_names) else f"object_{class_id}"
                            class_threshold = self._get_class_threshold(class_name)

                            if confidence > class_threshold:
                                center_x = int(detection[0] * width)
                                center_y = int(detection[1] * height)
                                w = int(detection[2] * width)
                                h = int(detection[3] * height)

                                x = int(center_x - w / 2)
                                y = int(center_y - h / 2)
                                
                                # Ensure box is within image bounds
                                x = max(0, x)
                                y = max(0, y)
                                w = min(width - x, w)
                                h = min(height - y, h)

                                # Filter by box size to remove small false positives
                                if self._is_valid_box(x, y, w, h):
                                    boxes.append([x, y, w, h])
                                    confidences.append(float(confidence))
                                    class_ids.append(int(class_id))

                # Apply non-maximum suppression
                indices = cv2.dnn.NMSBoxes(boxes, confidences, self.confidence_threshold, self.nms_threshold)

                if len(indices) > 0:
                    for i in indices.flatten():
                        x, y, w, h = boxes[i]
                        class_id = class_ids[i]
                        confidence = confidences[i]

                        # Get class name
                        class_name = class_names[class_id] if class_id < len(class_names) else f"object_{class_id}"

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
                # Fallback to OpenCV's built-in object detection
                detections = self._fallback_detection(image)

            return detections

        except Exception as e:
            print(f"OpenCV Service: YOLO detection error: {e}")
            return []

    def _fallback_detection(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Fallback detection using HOG descriptor"""
        detections = []
        
        try:
            # Use HOG descriptor for person detection
            hog = cv2.HOGDescriptor()
            hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

            # Detect people in the image
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

            # Also use OpenCV's CascadeClassifier for face detection
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
        """Recognize faces using Haar Cascade classifier and face recognition"""
        start_time = time.time()

        try:
            # Check Redis cache first
            cached = redis_cache.get(file_hash)
            if cached:
                print(f"OpenCV Service: Using Redis cached result for {file_hash}")
                return {
                    'success': True,
                    'cached': True,
                    'faceDetections': cached['face_detections'],
                    'processingTime': cached['processing_time'],
                    'fileHash': file_hash
                }

            # Check if image exists
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"Image not found: {image_path}")

            # Read and process image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError("Failed to read image")

            face_detections = self._detect_faces(image)

            processing_time = (time.time() - start_time) * 1000

            # Cache in Redis
            redis_cache.set(file_hash, [], face_detections, processing_time)

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
        """Detect and recognize faces using face_recognition library (CNN model)"""
        face_detections = []

        try:
            # Use CNN model for detection (matches training)
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            import face_recognition as fr_lib
            face_locs = fr_lib.face_locations(rgb_image, model='hog')

            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            import face_recognition as fr_lib

            for i, (top, right, bottom, left) in enumerate(face_locs):
                face_roi = image[top:bottom, left:right]
                face_roi_rgb = rgb_image[top:bottom, left:right]
                
                encodings = fr_lib.face_encodings(face_roi_rgb)
                
                if encodings:
                    import face_recognition
                    matches = fr_lib.compare_faces(face_recognition.known_encodings, encodings[0], tolerance=0.6)
                    distances = fr_lib.face_distance(face_recognition.known_encodings, encodings[0])
                    
                    if True in matches:
                        idx = np.argmin(distances)
                        person_name = face_recognition.known_names[idx]
                        conf = max(0, min(100, (1 - distances[idx]) * 100))
                    else:
                        person_name = "unknown"
                        conf = 80.0
                else:
                    person_name = "unknown"
                    conf = 80.0

                face_detections.append({
                    'id': f'face_{i}',
                    'name': person_name,
                    'confidence': float(conf),
                    'isKnown': person_name != 'unknown',
                    'bbox': {'x': int(left), 'y': int(top), 'width': int(right - left), 'height': int(bottom - top)}
                })

            return face_detections

        except Exception as e:
            print(f"OpenCV Service: Face detection error: {e}")
            return []

class MotionDetector:
    """Motion detection using background subtraction algorithms"""
    
    def __init__(self):
        self.initialized = False
        self.bg_subtractors = {}  # Separate background subtractor for each camera/stream
        self.last_frames = {}
        
        # Use MOG2 (better for outdoor/variable lighting) or KNN (faster)
        self.use_mog2 = True
        
    def initialize(self):
        """Initialize motion detector"""
        if self.initialized:
            return
            
        self.initialized = True
        print("OpenCV Service: Motion detection initialized")
    
    def _get_bg_subtractor(self, camera_id: str):
        """Get or create background subtractor for specific camera"""
        if camera_id not in self.bg_subtractors:
            if self.use_mog2:
                # MOG2: Adaptive Gaussian Mixture-based Background/Foreground Segmentation
                # OPTIMIZED: More sensitive parameters for better motion detection
                bg_subtractor = cv2.createBackgroundSubtractorMOG2(
                    history=200,        # OPTIMIZED: Reduced from 500 - adapts faster to changes
                    varThreshold=8,     # OPTIMIZED: Reduced from 16 - 2x more sensitive to motion
                    detectShadows=False # OPTIMIZED: Disabled - reduces noise from shadows
                )
            else:
                # KNN: K-Nearest Neighbors-based background subtraction
                # Faster and simpler
                bg_subtractor = cv2.createBackgroundSubtractorKNN(
                    history=500,        # Number of frames used
                    dist2Threshold=400, # Threshold on the squared distance
                    detectShadows=True
                )
            
            self.bg_subtractors[camera_id] = bg_subtractor
        
        return self.bg_subtractors[camera_id]
    
    def detect_motion(self, image: np.ndarray, camera_id: str = "default", 
                     threshold: int = 500) -> Dict[str, Any]:
        """
        Detect motion in an image using background subtraction
        
        Args:
            image: Input image (BGR format)
            camera_id: Camera/stream identifier for separate background models
            threshold: Minimum number of changed pixels to consider as motion
            
        Returns:
            Dict with motion detection results including:
            - motion_detected: Boolean
            - motion_percentage: Percentage of image with motion
            - motion_mask: Binary mask of motion areas
            - contour_count: Number of motion contours found
        """
        if not self.initialized:
            self.initialize()
        
        try:
            # Get background subtractor for this camera
            bg_subtractor = self._get_bg_subtractor(camera_id)
            
            # Resize image for faster processing (max 640x640)
            scale_factor = 1.0
            original_shape = image.shape[:2]
            if image.shape[0] > 640 or image.shape[1] > 640:
                scale_factor = 640.0 / max(image.shape[0], image.shape[1])
                image = cv2.resize(image, (0, 0), fx=scale_factor, fy=scale_factor)
            
            # Apply background subtraction
            fg_mask = bg_subtractor.apply(image)
            
            # Remove shadows (gray pixels) - keep only white (foreground)
            # MOG2 marks shadows as 127 (gray), so threshold to keep only 255 (foreground)
            _, fg_mask = cv2.threshold(fg_mask, 250, 255, cv2.THRESH_BINARY)
            
            # OPTIMIZED: Lighter morphological operations to preserve motion detail
            # Use smaller kernel for opening (remove small noise)
            kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))  # OPTIMIZED: (5,5) -> (3,3)
            fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel_open, iterations=1)  # OPTIMIZED: 2 -> 1
            
            # Use smaller kernel for closing (fill holes)
            kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))  # OPTIMIZED: (7,7) -> (3,3)
            fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel_close, iterations=1)  # OPTIMIZED: 2 -> 1
            
            # Dilate to merge nearby regions
            kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            fg_mask = cv2.dilate(fg_mask, kernel_dilate, iterations=1)
            
            # Calculate motion statistics
            motion_pixels = cv2.countNonZero(fg_mask)
            total_pixels = fg_mask.shape[0] * fg_mask.shape[1]
            motion_percentage = (motion_pixels / total_pixels) * 100
            
            # Find contours for motion regions
            contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Filter small contours (noise) - use adaptive minimum area based on image size
            min_contour_area = max(150, int((image.shape[0] * image.shape[1]) * 0.001))
            significant_contours = [c for c in contours if cv2.contourArea(c) > min_contour_area]
            
            # Calculate total area of significant contours
            total_contour_area = sum(cv2.contourArea(c) for c in significant_contours)
            contour_area_percentage = (total_contour_area / total_pixels) * 100
            
            # OPTIMIZED: Lower threshold for better sensitivity
            # Motion is detected if:
            # 1. Enough pixels changed (>0.2%), OR
            # 2. There are significant contours with sufficient total area (>0.15%)
            motion_detected = (motion_percentage > 0.2) or (contour_area_percentage > 0.15)
            
            # Calculate motion regions
            motion_regions = []
            for contour in significant_contours:
                x, y, w, h = cv2.boundingRect(contour)
                # Scale back to original image size if we resized
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
            
            # Sort regions by area (largest first)
            motion_regions.sort(key=lambda r: r['area'], reverse=True)
            
            # OPTIMIZED: More generous confidence calculation (better reporting)
            # Increased multiplier from 5 to 8 for more accurate confidence values
            confidence = max(0, min(100, (motion_percentage * 8 + contour_area_percentage * 8)))
            
            result = {
                'motion_detected': motion_detected,
                'motion_percentage': round(motion_percentage, 2),
                'contour_area_percentage': round(contour_area_percentage, 2),
                'motion_pixel_count': int(motion_pixels),
                'contour_count': len(significant_contours),
                'motion_regions': motion_regions[:10],  # Limit to top 10 regions
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
        """
        Compare two frames directly for motion detection (alternative method)
        Useful for comparing consecutive frames without building background model
        
        Args:
            frame1: Previous frame
            frame2: Current frame
            
        Returns:
            Dict with motion detection results
        """
        try:
            # Resize frames to same size if needed
            if frame1.shape != frame2.shape:
                frame2 = cv2.resize(frame2, (frame1.shape[1], frame1.shape[0]))
            
            # Convert to grayscale
            gray1 = cv2.cvtColor(frame1, cv2.COLOR_BGR2GRAY)
            gray2 = cv2.cvtColor(frame2, cv2.COLOR_BGR2GRAY)
            
            # Apply Gaussian blur to reduce noise
            gray1 = cv2.GaussianBlur(gray1, (5, 5), 0)
            gray2 = cv2.GaussianBlur(gray2, (5, 5), 0)
            
            # Calculate absolute difference
            diff = cv2.absdiff(gray1, gray2)
            
            # Apply adaptive threshold
            # Lower threshold (20) to detect subtle motion, but will filter with morphological operations
            _, thresh = cv2.threshold(diff, 20, 255, cv2.THRESH_BINARY)
            
            # Enhanced morphological operations to reduce noise
            kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel_open, iterations=2)
            
            kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
            thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel_close, iterations=2)
            
            # Dilate to merge nearby regions
            kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            thresh = cv2.dilate(thresh, kernel_dilate, iterations=1)
            
            # Calculate statistics
            motion_pixels = cv2.countNonZero(thresh)
            total_pixels = thresh.shape[0] * thresh.shape[1]
            motion_percentage = (motion_pixels / total_pixels) * 100
            
            # Find contours
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Filter small contours - adaptive minimum based on image size
            min_contour_area = max(150, int((thresh.shape[0] * thresh.shape[1]) * 0.001))
            significant_contours = [c for c in contours if cv2.contourArea(c) > min_contour_area]
            
            # Calculate total contour area
            total_contour_area = sum(cv2.contourArea(c) for c in significant_contours)
            contour_area_percentage = (total_contour_area / total_pixels) * 100
            
            # Motion detection uses both pixel percentage and contour area
            motion_detected = (motion_percentage > 0.3) or (contour_area_percentage > 0.2)
            
            # Improved confidence calculation
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

class FaceRecognition:
    """Enhanced face recognition using deep learning models"""

    def __init__(self):
        self.known_faces_dir = os.path.join(os.path.dirname(__file__), 'known_faces')
        self.models_dir = os.path.join(os.path.dirname(__file__), 'models')
        self.model_path = os.path.join(self.models_dir, 'enhanced_face_recognizer.pkl')
        self.embeddings_path = os.path.join(self.models_dir, 'face_embeddings_improved.pkl')
        self.labels_path = os.path.join(self.models_dir, 'face_labels_improved.pkl')
        self.labels = {}
        self.is_trained = False

        # Create directories if they don't exist
        if not os.path.exists(self.known_faces_dir):
            os.makedirs(self.known_faces_dir)
        if not os.path.exists(self.models_dir):
            os.makedirs(self.models_dir)

        # Initialize face detection and recognition models
        self.face_detector = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )

        # Try to load DNN face detector for better accuracy
        self.dnn_face_detector = self._load_dnn_face_detector()

        # Initialize face embeddings model
        self.face_embeddings_model = self._load_face_embeddings_model()

        # Load trained model if it exists
        self.known_encodings = []
        self.known_names = []
        self._load_trained_model()

    def _load_dnn_face_detector(self):
        """Load DNN-based face detector for better accuracy"""
        try:
            # Try to load a DNN face detection model
            prototxt_path = os.path.join(self.models_dir, 'deploy.prototxt')
            model_path = os.path.join(self.models_dir, 'res10_300x300_ssd_iter_140000_fp16.caffemodel')

            if os.path.exists(prototxt_path) and os.path.exists(model_path):
                net = cv2.dnn.readNetFromCaffe(prototxt_path, model_path)
                return net
            else:
                print("DNN face detector model files not found, using Haar cascade")
                return None
        except Exception as e:
            print(f"DNN face detector not available: {e}")
            return None

    def _load_face_embeddings_model(self):
        """Load face embeddings model for better recognition"""
        try:
            # Placeholder for loading face embedding model
            return None
        except Exception as e:
            print(f"Face embeddings model not available: {e}")
            return None

    def _load_trained_model(self):
        """Load previously trained face recognition model"""
        try:
            if os.path.exists(self.embeddings_path) and os.path.exists(self.labels_path):
                with open(self.embeddings_path, 'rb') as f:
                    self.known_encodings = pickle.load(f)
                with open(self.labels_path, 'rb') as f:
                    self.known_names = pickle.load(f)
                self.is_trained = True
                print(f"Loaded trained model with {len(self.known_names)} known faces")
        except Exception as e:
            print(f"Failed to load trained model: {e}")

    def extract_face_features(self, face_img):
        """Extract features from face image using face_recognition library"""
        try:
            import face_recognition
            # Convert to RGB (OpenCV uses BGR)
            rgb_face = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
            # Use face_recognition library for feature extraction
            encodings = face_recognition.face_encodings(rgb_face)
            if encodings:
                return encodings[0]
            return None
        except Exception as e:
            print(f"Error extracting face features: {e}")
            return None

    def detect_faces_dnn(self, image):
        """Detect faces using DNN model"""
        if self.dnn_face_detector is None:
            return self.detect_faces_haar(image)

        try:
            h, w = image.shape[:2]
            blob = cv2.dnn.blobFromImage(cv2.resize(image, (300, 300)), 1.0, (300, 300), (104.0, 177.0, 123.0))
            self.dnn_face_detector.setInput(blob)
            detections = self.dnn_face_detector.forward()

            faces = []
            for i in range(detections.shape[2]):
                confidence = detections[0, 0, i, 2]

                if confidence > 0.5:  # Confidence threshold
                    box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                    x, y, x1, y1 = box.astype(int)

                    # Ensure coordinates are within image bounds
                    x, y = max(0, x), max(0, y)
                    x1, y1 = min(w, x1), min(h, y1)

                    faces.append((x, y, x1-x, y1-y))

            return faces
        except Exception as e:
            print(f"Error in DNN face detection: {e}")
            return self.detect_faces_haar(image)

    def detect_faces_haar(self, image):
        """Detect faces using Haar cascade (fallback)"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = self.face_detector.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30),
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        return faces

    def recognize_face(self, face_img):
        """Recognize a face using trained model"""
        if not self.is_trained or len(self.known_encodings) == 0:
            return "unknown", 0.0

        try:
            # Extract features from the input face
            face_features = self.extract_face_features(face_img)
            if face_features is None:
                return "unknown", 0.0

            # Calculate distances to known faces
            distances = []
            for known_encoding in self.known_encodings:
                distance = np.linalg.norm(face_features - known_encoding)
                distances.append(distance)

            # Find the closest match
            if distances:
                min_distance_idx = np.argmin(distances)
                min_distance = distances[min_distance_idx]

                # Convert distance to similarity score
                threshold = 0.6  # Adjust based on your needs
                similarity = max(0, 100 - min_distance * 100)

                if min_distance < threshold:
                    return self.known_names[min_distance_idx], similarity
                else:
                    return "unknown", similarity
            else:
                return "unknown", 0.0

        except Exception as e:
            print(f"Error recognizing face: {e}")
            return "unknown", 0.0

    def train_recognizer(self):
        """Train the face recognizer with known faces"""
        try:
            faces = []
            names = []

            for person_dir in os.listdir(self.known_faces_dir):
                person_path = os.path.join(self.known_faces_dir, person_dir)
                if not os.path.isdir(person_path):
                    continue

                for image_file in os.listdir(person_path):
                    if image_file.lower().endswith(('.png', '.jpg', '.jpeg')):
                        image_path = os.path.join(person_path, image_file)
                        image = cv2.imread(image_path)

                        if image is not None:
                            # Extract face features
                            face_features = self.extract_face_features(image)
                            if face_features is not None:
                                faces.append(face_features)
                                names.append(person_dir)

            if faces:
                self.known_encodings = faces
                self.known_names = names
                self.is_trained = True

                # Save the trained model
                with open(self.embeddings_path, 'wb') as f:
                    pickle.dump(self.known_encodings, f)
                with open(self.labels_path, 'wb') as f:
                    pickle.dump(self.known_names, f)

                print(f"Trained face recognizer with {len(names)} faces from {len(set(names))} people")
            else:
                print("No training data found for face recognition")

        except Exception as e:
            print(f"Error training face recognizer: {e}")

    def _detect_faces(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Detect and recognize faces using Haar Cascade classifier and face recognition"""
        face_detections = []

        try:
            # Use DNN face detector for better accuracy
            faces = self.detect_faces_dnn(image)

            for i, (x, y, w, h) in enumerate(faces):
                # Extract face region
                face_roi = image[y:y+h, x:x+w]

                # Recognize the face
                person_name, recognition_confidence = self.recognize_face(face_roi)

                # Use recognition confidence if available, otherwise default confidence
                confidence = recognition_confidence if recognition_confidence > 0 else 80.0

                face_detections.append({
                    'id': f'face_{i}',
                    'name': person_name,
                    'confidence': float(confidence),
                    'isKnown': person_name != 'unknown',
                    'bbox': {
                        'x': int(x),
                        'y': int(y),
                        'width': int(w),
                        'height': int(h)
                    }
                })

            return face_detections

        except Exception as e:
            print(f"OpenCV Service: Face detection error: {e}")
            return []

# Try to import improved face recognition module
try:
    from improved_face_recognition import ImprovedFaceRecognition
    print("OpenCV Service: Using improved face recognition module")
    FaceRecognition = ImprovedFaceRecognition
except ImportError:
    print("OpenCV Service: Improved face recognition not available, using basic module")
    # Keep the existing FaceRecognition class defined in this file

# Initialize face recognition
face_recognition = FaceRecognition()

# Initialize detector
detector = YOLOObjectDetector()
detector.initialize()

# Initialize motion detector
motion_detector = MotionDetector()
motion_detector.initialize()

@app.route('/detect-motion', methods=['POST'])
def detect_motion_route():
    """Motion detection endpoint - accepts image data directly or compares two frames"""
    try:
        # Handle both single frame (background subtraction) and two frames (comparison)
        if 'image1' in request.files and 'image2' in request.files:
            # Compare two frames
            image_file1 = request.files['image1']
            image_file2 = request.files['image2']
            
            image1 = cv2.imdecode(np.frombuffer(image_file1.read(), np.uint8), cv2.IMREAD_COLOR)
            image2 = cv2.imdecode(np.frombuffer(image_file2.read(), np.uint8), cv2.IMREAD_COLOR)
            
            if image1 is None or image2 is None:
                return jsonify({'success': False, 'error': 'Failed to decode images'}), 400
            
            result = motion_detector.detect_motion_with_images(image1, image2)
            
        elif 'image' in request.files:
            # Single frame with background subtraction
            image_file = request.files['image']
            camera_id = request.form.get('cameraId', 'default')
            
            image = cv2.imdecode(np.frombuffer(image_file.read(), np.uint8), cv2.IMREAD_COLOR)
            
            if image is None:
                return jsonify({'success': False, 'error': 'Failed to decode image'}), 400
            
            result = motion_detector.detect_motion(image, camera_id)
            
        elif request.data:
            # Raw binary data
            image = cv2.imdecode(np.frombuffer(request.data, np.uint8), cv2.IMREAD_COLOR)
            camera_id = request.form.get('cameraId', 'default')
            
            if image is None:
                return jsonify({'success': False, 'error': 'Failed to decode image'}), 400
            
            result = motion_detector.detect_motion(image, camera_id)
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


@app.route('/detect-objects', methods=['POST'])
def detect_objects_route():
    """Object detection endpoint - accepts image data directly"""
    try:
        if 'image' not in request.files and not request.data:
            return jsonify({'success': False, 'error': 'No image file or data provided'}), 400

        # Handle both file upload and raw binary data
        if request.files.get('image'):
            image_file = request.files['image']
            file_hash = request.form.get('fileHash', hashlib.md5(image_file.read()).hexdigest())
            image_file.seek(0)
            
            # Read as numpy array
            image_data = np.frombuffer(image_file.read(), np.uint8)
            image = cv2.imdecode(image_data, cv2.IMREAD_COLOR)
        else:
            # Raw binary data
            image_data = np.frombuffer(request.data, np.uint8)
            image = cv2.imdecode(image_data, cv2.IMREAD_COLOR)
            file_hash = request.form.get('fileHash', hashlib.md5(request.data).hexdigest())

        if image is None:
            return jsonify({'success': False, 'error': 'Failed to decode image'}), 400

        print(f"OpenCV Service: Object detection request for {file_hash}")

        # Perform detection
        detections = detector._perform_yolo_detection(image)

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


@app.route('/detect-and-draw', methods=['POST'])
def detect_and_draw_route():
    """Object detection with bounding box overlay - returns annotated image"""
    try:
        if 'image' not in request.files and not request.data:
            return jsonify({'success': False, 'error': 'No image file or data provided'}), 400

        # Handle both file upload and raw binary data
        if request.files.get('image'):
            image_file = request.files['image']
            image_data = np.frombuffer(image_file.read(), np.uint8)
            image = cv2.imdecode(image_data, cv2.IMREAD_COLOR)
        else:
            image_data = np.frombuffer(request.data, np.uint8)
            image = cv2.imdecode(image_data, cv2.IMREAD_COLOR)

        if image is None:
            return jsonify({'success': False, 'error': 'Failed to decode image'}), 400

        # Perform detection
        detections = detector._perform_yolo_detection(image)

        # Draw bounding boxes on image
        annotated_image = draw_detections(image, detections)

        # Convert to JPEG
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


@app.route('/annotate-by-path', methods=['POST'])
def annotate_by_path_route():
    """Annotate image by file path - accepts JSON with 'path' field"""
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

        detections = detector._perform_yolo_detection(image)
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


def draw_detections(image: np.ndarray, detections: List[Dict]) -> np.ndarray:
    """Draw bounding boxes and labels on image"""
    try:
        # Create a copy to avoid modifying original
        result = image.copy()
        
        # Define colors for different classes
        colors = {
            'person': (0, 255, 0),      # Green
            'car': (255, 0, 0),         # Blue
            'truck': (200, 0, 0),       # Dark blue
            'motorcycle': (0, 128, 255), # Orange
            'bicycle': (255, 165, 0),   # Orange
            'dog': (0, 165, 255),       # Orange
            'cat': (128, 0, 128),       # Purple
            'face': (255, 0, 255),      # Magenta
        }
        
        for detection in detections:
            bbox = detection.get('bbox', {})
            x = bbox.get('x', 0)
            y = bbox.get('y', 0)
            w = bbox.get('width', 0)
            h = bbox.get('height', 0)
            class_name = detection.get('class', 'object')
            confidence = detection.get('confidence', 0)
            
            # Get color for this class
            color = colors.get(class_name.lower(), (0, 255, 255))  # Cyan default
            
            # Draw bounding box
            cv2.rectangle(result, (x, y), (x + w, y + h), color, 2)
            
            # Draw label background
            label = f"{class_name}: {confidence}%"
            (label_width, label_height), _ = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1
            )
            cv2.rectangle(result, (x, y - label_height - 10), (x + label_width, y), color, -1)
            
            # Draw label text
            cv2.putText(
                result, label, (x, y - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1
            )
        
        return result
        
    except Exception as e:
        print(f"Error drawing detections: {e}")
        return image


@app.route('/recognize-faces', methods=['POST'])
def recognize_faces_route():
    """Face recognition endpoint - accepts image data directly"""
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

        result = detector.recognize_faces(temp_image_path, file_hash, '', file_size, file_modified)

        if os.path.exists(temp_image_path):
            os.unlink(temp_image_path)

        return jsonify(result)

    except Exception as e:
        print(f"OpenCV Service: Face recognition error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'service': 'opencv-detection',
        'version': os.getenv('SERVICE_VERSION', '1.0.0'),
        'detectionMode': 'yolo',
        'model': {
            'type': 'YOLO',
            'initialized': detector.initialized,
            'classCount': len(class_names)
        },
        'cache': {
            'type': 'redis',
            'connected': redis_client.ping() if redis_client else False
        }
    })


@app.route('/status')
def status():
    """Status endpoint"""
    return jsonify({
        'status': 'ready',
        'initialized': detector.initialized,
        'service': 'opencv-detection',
        'detectionMode': 'yolo',
        'classNames': len(class_names)
    })


@app.route('/detect-batch', methods=['POST'])
def detect_batch():
    """Batch detection endpoint - accepts multiple images and processes them in parallel"""
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
                result = detector.detect_objects(temp_image_path, file_hash, '', 0, '')
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


@app.route('/detect-batch-paths', methods=['POST'])
def detect_batch_paths():
    """
    Batch detection endpoint that accepts file paths instead of file uploads.
    More efficient for server-side batch processing where files are already accessible.
    
    Expected JSON payload:
    {
        "imagePaths": ["/app/data/detections/.../image1.jpg", "/app/data/detections/.../image2.jpg"],
        "batchHash": "optional_batch_identifier"
    }
    """
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
            # Generate hash from file path for caching
            file_hash = hashlib.md5(image_path.encode()).hexdigest()
            
            # Check if file exists
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
                # Detect objects using file path directly
                result = detector.detect_objects(image_path, file_hash, '', 0, '')
                
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


@app.route('/train-face', methods=['POST'])
def train_face():
    """Endpoint to add a known face for training - accepts image upload"""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file provided'}), 400
            
        image_file = request.files['image']
        person_name = request.form.get('personName')

        if not person_name:
            return jsonify({
                'success': False,
                'error': 'personName is required'
            }), 400

        # Create person directory if it doesn't exist
        person_dir = os.path.join(face_recognition.known_faces_dir, person_name)
        if not os.path.exists(person_dir):
            os.makedirs(person_dir)

        # Save image to person's directory with a unique name
        timestamp = int(time.time() * 1000)
        filename = f"{timestamp}_{image_file.filename}" if image_file.filename else f"{timestamp}.jpg"
        dest_path = os.path.join(person_dir, filename)
        
        image_file.save(dest_path)

        # Retrain the recognizer
        face_recognition.train_recognizer()

        return jsonify({
            'success': True,
            'message': f'Face for {person_name} added and model retrained'
        })
    except Exception as e:
        print(f"OpenCV Service: Face training error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/retrain-model', methods=['POST'])
def retrain_model():
    """Endpoint to retrain the face recognition model"""
    try:
        face_recognition.train_recognizer()
        return jsonify({
            'success': True,
            'message': 'Face recognition model retrained successfully'
        })
    except Exception as e:
        print(f"OpenCV Service: Model retraining error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/known-faces', methods=['GET'])
def get_known_faces():
    """Endpoint to list known faces"""
    try:
        faces = []
        if face_recognition.is_trained:
            # Use known_names list (may have duplicates for multiple embeddings per person)
            unique_names = set(face_recognition.known_names)
            for idx, name in enumerate(unique_names):
                faces.append({
                    'id': str(idx),
                    'name': name
                })
        
        return jsonify({
            'success': True,
            'faces': faces,
            'count': len(faces)
        })
    except Exception as e:
        print(f"OpenCV Service: Get known faces error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    print(f"🚀 OpenCV Microservice started on port {PORT}")
    print(f"📊 Health check: http://localhost:{PORT}/health")
    print(f"🔍 Status check: http://localhost:{PORT}/status")
    app.run(host='0.0.0.0', port=PORT, threaded=True)
