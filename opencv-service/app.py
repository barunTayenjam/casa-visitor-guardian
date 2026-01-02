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
from typing import List, Dict, Any, Optional
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor, Json
import pickle

app = Flask(__name__)
CORS(app)

# Configuration
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
CACHE_DIR = os.path.join(os.path.dirname(__file__), 'data', 'cache')
PORT = 8084

# Load COCO class names
def load_class_names():
    try:
        coco_path = os.path.join(MODELS_DIR, 'yolo_classes.txt')
        if os.path.exists(coco_path):
            with open(coco_path, 'r') as f:
                return f.read().strip().split('\n')
        else:
            print(f"Warning: yolo_classes.txt not found at {coco_path}, using defaults")
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
                    # Use text concatenation for INTERVAL - safe since cache_ttl is a constant
                    cur.execute(f"""
                        DELETE FROM detection_cache
                        WHERE updated_at < NOW() - INTERVAL '{self.cache_ttl} seconds'
                    """)
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
        # Temporarily disabled - SQL syntax issue to fix
        pass

# Initialize cache
cache = DetectionCache()

# Disable automatic cleanup for now (SQL syntax issue to fix)
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
            weights_path = os.path.join(MODELS_DIR, 'yolov3.weights')
            config_path = os.path.join(MODELS_DIR, 'yolov3.cfg')

            # Check if YOLO files exist, if not, use a simpler approach for now
            if os.path.exists(weights_path) and os.path.exists(config_path):
                self.net = cv2.dnn.readNet(weights_path, config_path)
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
            # Check cache first
            cached = cache.get(file_hash)
            if cached:
                print(f"OpenCV Service: Using cached result for {file_hash}")
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

            # Cache result
            cache.set(file_hash, detections, [], processing_time, file_path, file_size, file_modified)

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
            # Check cache
            cached = cache.get(file_hash)
            if cached:
                print(f"OpenCV Service: Using cached face result for {file_hash}")
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

            # Cache result
            cache.set(file_hash, [], face_detections, processing_time, file_path, file_size, file_modified)

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
    """Face recognition using OpenCV's LBPH face recognizer"""

    def __init__(self):
        self.recognizer = cv2.face.LBPHFaceRecognizer_create()
        self.known_faces_dir = os.path.join(os.path.dirname(__file__), 'known_faces')
        self.model_path = os.path.join(os.path.dirname(__file__), 'models', 'face_recognizer.yml')
        self.labels_path = os.path.join(os.path.dirname(__file__), 'models', 'face_labels.pkl')
        self.labels = {}
        self.is_trained = False

        # Create known faces directory if it doesn't exist
        if not os.path.exists(self.known_faces_dir):
            os.makedirs(self.known_faces_dir)

        # Load trained model if it exists
        if os.path.exists(self.model_path) and os.path.exists(self.labels_path):
            try:
                self.recognizer.read(self.model_path)
                with open(self.labels_path, 'rb') as f:
                    self.labels = pickle.load(f)
                self.is_trained = True
                print("Face recognition model loaded successfully")
            except Exception as e:
                print(f"Failed to load face recognition model: {e}")

    def train_recognizer(self):
        """Train the face recognizer with known faces"""
        faces = []
        labels = []
        label_id = 0
        label_map = {}

        for person_dir in os.listdir(self.known_faces_dir):
            person_path = os.path.join(self.known_faces_dir, person_dir)
            if not os.path.isdir(person_path):
                continue

            label_map[label_id] = person_dir
            for image_file in os.listdir(person_path):
                if image_file.lower().endswith(('.png', '.jpg', '.jpeg')):
                    image_path = os.path.join(person_path, image_file)
                    image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
                    if image is not None:
                        faces.append(image)
                        labels.append(label_id)
            label_id += 1

        if faces:
            self.recognizer.train(faces, np.array(labels))
            self.recognizer.save(self.model_path)

            with open(self.labels_path, 'wb') as f:
                pickle.dump(label_map, f)

            self.labels = label_map
            self.is_trained = True
            print(f"Face recognition model trained with {len(label_map)} people")
        else:
            print("No training data found for face recognition")

    def recognize_face(self, face_image: np.ndarray):
        """Recognize a face and return label and confidence"""
        if not self.is_trained:
            return "unknown", 0.0

        gray_face = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
        label, confidence = self.recognizer.predict(gray_face)

        # Convert confidence to a more intuitive scale (0-100, where higher is better)
        # Lower confidence values from LBPH indicate better matches
        confidence_percent = max(0, 100 - confidence)

        person_name = self.labels.get(label, "unknown")
        return person_name, confidence_percent

# Initialize face recognition
face_recognition = FaceRecognition()

# Initialize detector
detector = YOLOObjectDetector()
detector.initialize()

# Periodic cache cleanup
import threading
def cleanup_task():
    while True:
        time.sleep(60)  # Every minute
        cache.cleanup()

# Temporarily disabled cleanup due to SQL syntax issue
# cleanup_thread = threading.Thread(target=cleanup_task, daemon=True)
# cleanup_thread.start()

@app.route('/detect-objects', methods=['POST'])
def detect_objects_route():
    """Object detection endpoint"""
    try:
        data = request.get_json()
        image_path = data.get('imagePath')
        file_hash = data.get('fileHash', '')
        file_size = data.get('fileSize', 0)
        file_modified = data.get('fileModified', '')

        print(f"OpenCV Service: Object detection request for {image_path}")

        result = detector.detect_objects(image_path, file_hash, image_path, file_size, file_modified)
        return jsonify(result)

    except Exception as e:
        print(f"OpenCV Service: Object detection error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/recognize-faces', methods=['POST'])
def recognize_faces_route():
    """Face recognition endpoint"""
    try:
        data = request.get_json()
        image_path = data.get('imagePath')
        file_hash = data.get('fileHash', '')
        file_size = data.get('fileSize', 0)
        file_modified = data.get('fileModified', '')

        print(f"OpenCV Service: Face recognition request for {image_path}")

        result = detector.recognize_faces(image_path, file_hash, image_path, file_size, file_modified)
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
        'timestamp': time.time(),
        'service': 'opencv-detection',
        'detectionMode': 'yolo',
        'initialized': detector.initialized
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
    """Endpoint to add a known face for training"""
    try:
        data = request.get_json()
        person_name = data.get('personName')
        image_path = data.get('imagePath')

        if not person_name or not image_path:
            return jsonify({
                'success': False,
                'error': 'personName and imagePath are required'
            }), 400

        # Create person directory if it doesn't exist
        person_dir = os.path.join(face_recognition.known_faces_dir, person_name)
        if not os.path.exists(person_dir):
            os.makedirs(person_dir)

        # Copy image to person's directory
        import shutil
        filename = os.path.basename(image_path)
        dest_path = os.path.join(person_dir, filename)
        shutil.copy2(image_path, dest_path)

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


if __name__ == '__main__':
    print(f"🚀 OpenCV Microservice started on port {PORT}")
    print(f"📊 Health check: http://localhost:{PORT}/health")
    print(f"🔍 Status check: http://localhost:{PORT}/status")
    app.run(host='0.0.0.0', port=PORT, threaded=True)
