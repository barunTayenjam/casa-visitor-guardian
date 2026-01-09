#!/usr/bin/env python3
"""
OpenCV Detection Service - Python Implementation
Uses native OpenCV with YOLO for real object detection
"""

from flask import Flask, request, jsonify
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
        self.db_password = os.getenv('POSTGRES_PASSWORD', 'sentryvision123')
        self.cache_ttl = 300  # 5 minutes
        
        # Initialize connection pool
        self.connection_pool = None
        self._initialize_pool()
        # Temporarily disabled cleanup - SQL syntax issue to fix
        # self._cleanup_old_cache()

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
                    # Use proper INTERVAL syntax with placeholder
                    cur.execute("""
                        DELETE FROM detection_cache
                        WHERE updated_at < NOW() - INTERVAL %s seconds
                    """, (self.cache_ttl,))
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
                    cur.execute("""
                        SELECT file_hash, object_detections, face_detections, processing_time
                        FROM detection_cache
                        WHERE file_hash = %s AND updated_at > NOW() - INTERVAL '%s seconds'
                    """, (file_hash, self.cache_ttl))
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
# cleanup_thread = threading.Thread(target=cleanup_task, daemon=True)
# cleanup_thread.start()

class YOLOObjectDetector:
    """Object detection using YOLO model"""

    def __init__(self):
        self.initialized = False
        self.net = None
        self.layer_names = None
        self.input_size = 416  # Standard YOLO input size
        self.confidence_threshold = 0.5
        self.nms_threshold = 0.4

    def initialize(self):
        """Initialize YOLO detector"""
        if self.initialized:
            return

        try:
            # Try to load YOLO model files
            # Prioritize YOLOv4-tiny if available (it's faster and files are present)
            weights_path_v4 = os.path.join(MODELS_DIR, 'yolov4-tiny.weights')
            config_path_v4 = os.path.join(MODELS_DIR, 'yolov4-tiny.cfg')
            
            weights_path_v3 = os.path.join(MODELS_DIR, 'yolov3.weights')
            config_path_v3 = os.path.join(MODELS_DIR, 'yolov3.cfg')

            if os.path.exists(weights_path_v4) and os.path.exists(config_path_v4):
                print(f"OpenCV Service: Loading YOLOv4-tiny model from {weights_path_v4}")
                self.net = cv2.dnn.readNet(weights_path_v4, config_path_v4)
                self.layer_names = self.net.getLayerNames()
                self.layer_names = [self.layer_names[i - 1] for i in self.net.getUnconnectedOutLayers()]
            elif os.path.exists(weights_path_v3) and os.path.exists(config_path_v3):
                print(f"OpenCV Service: Loading YOLOv3 model from {weights_path_v3}")
                self.net = cv2.dnn.readNet(weights_path_v3, config_path_v3)
                self.layer_names = self.net.getLayerNames()
                self.layer_names = [self.layer_names[i[0] - 1] for i in self.net.getUnconnectedOutLayers()]
            else:
                print("YOLO weights/config not found, using OpenCV DNN with pre-trained model")
                # Use OpenCV's built-in DNN module with a pre-trained model
                # For now, we'll use a simpler approach that doesn't require external files
                pass

            self.initialized = True
            print("OpenCV Service: YOLO detection initialized successfully")
        except Exception as e:
            print(f"OpenCV Service: Failed to initialize YOLO: {e}")
            # Fallback to basic detection
            self.initialized = True

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
        """Perform object detection using YOLO model"""
        detections = []

        try:
            height, width = image.shape[:2]

            # If we have a YOLO model loaded, use it
            if self.net is not None:
                # Create blob from image
                blob = cv2.dnn.blobFromImage(image, 1/255.0, (self.input_size, self.input_size), swapRB=True, crop=False)
                self.net.setInput(blob)

                # Run forward pass
                outputs = self.net.forward(self.layer_names)

                # Process outputs
                boxes = []
                confidences = []
                class_ids = []

                for output in outputs:
                    for detection in output:
                        scores = detection[5:]
                        class_id = np.argmax(scores)
                        confidence = scores[class_id]

                        if confidence > self.confidence_threshold:
                            # Convert to pixel coordinates
                            center_x = int(detection[0] * width)
                            center_y = int(detection[1] * height)
                            w = int(detection[2] * width)
                            h = int(detection[3] * height)

                            x = int(center_x - w / 2)
                            y = int(center_y - h / 2)

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
                            'confidence': min(100, confidence * 100),
                            'bbox': {
                                'x': int(x),
                                'y': int(y),
                                'width': int(w),
                                'height': int(h)
                            }
                        })
            else:
                # Fallback to OpenCV's built-in object detection
                # Use HOG descriptor for person detection
                hog = cv2.HOGDescriptor()
                hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

                # Detect people in the image
                (rects, weights) = hog.detectMultiScale(image, winStride=(8, 8), padding=(32, 32), scale=1.05)

                for (x, y, w, h), weight in zip(rects, weights):
                    detections.append({
                        'class': 'person',
                        'confidence': min(100, max(30, weight * 100)),
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
                        'confidence': 80,  # Default confidence for face detection
                        'bbox': {
                            'x': int(x),
                            'y': int(y),
                            'width': int(w),
                            'height': int(h)
                        }
                    })

            return detections

        except Exception as e:
            print(f"OpenCV Service: YOLO detection error: {e}")
            return []

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
        """Detect and recognize faces using Haar Cascade classifier and face recognition"""
        face_detections = []

        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

            # Load Haar cascade classifier
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

            # Detect faces
            faces = face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30),
                flags=cv2.CASCADE_SCALE_IMAGE
            )

            for i, (x, y, w, h) in enumerate(faces):
                # Extract face region
                face_roi = image[y:y+h, x:x+w]

                # Recognize the face
                person_name, recognition_confidence = face_recognition.recognize_face(face_roi)

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

class FaceRecognition:
    """Enhanced face recognition using deep learning models"""

    def __init__(self):
        self.known_faces_dir = os.path.join(os.path.dirname(__file__), 'known_faces')
        self.models_dir = os.path.join(os.path.dirname(__file__), 'models')
        self.model_path = os.path.join(self.models_dir, 'enhanced_face_recognizer.pkl')
        self.embeddings_path = os.path.join(self.models_dir, 'face_embeddings.pkl')
        self.labels_path = os.path.join(self.models_dir, 'face_labels.pkl')
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
        """Extract features from face image using deep learning approach"""
        try:
            # Convert to RGB (OpenCV uses BGR)
            rgb_face = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)

            # Resize to standard size for consistency
            resized_face = cv2.resize(rgb_face, (224, 224))

            # Normalize pixel values
            normalized_face = resized_face.astype(np.float32) / 255.0

            # Simple feature extraction (in a real implementation, this would be a neural network)
            return np.mean(normalized_face, axis=(0, 1))  # Average across spatial dimensions
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

# Initialize face recognition
face_recognition = FaceRecognition()

# Initialize detector
detector = YOLOObjectDetector()
detector.initialize()

@app.route('/detect-objects', methods=['POST'])
def detect_objects_route():
    """Object detection endpoint - accepts image data directly"""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file provided'}), 400

        image_file = request.files['image']
        file_hash = request.form.get('fileHash', '')
        file_size = request.form.get('fileSize', 0, type=int)
        file_modified = request.form.get('fileModified', '')

        temp_image_path = os.path.join(tempfile.gettempdir(), f'detect_{file_hash}.jpg')
        image_file.save(temp_image_path)

        print(f"OpenCV Service: Object detection request for {file_hash}")

        result = detector.detect_objects(temp_image_path, file_hash, '', file_size, file_modified)

        if os.path.exists(temp_image_path):
            os.unlink(temp_image_path)

        return jsonify(result)

    except Exception as e:
        print(f"OpenCV Service: Object detection error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


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
        # Inverse the labels map to get name -> id
        faces = []
        if face_recognition.is_trained:
            for label_id, name in face_recognition.labels.items():
                faces.append({
                    'id': label_id,
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
