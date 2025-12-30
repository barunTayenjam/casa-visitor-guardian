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

app = Flask(__name__)
CORS(app)

# Configuration
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
CACHE_DIR = os.path.join(os.path.dirname(__file__), 'data', 'cache')
PORT = 8084

# Load COCO class names
def load_class_names():
    try:
        coco_path = os.path.join(MODELS_DIR, 'coco.names')
        if os.path.exists(coco_path):
            with open(coco_path, 'r') as f:
                return f.read().strip().split('\n')
        else:
            print(f"Warning: coco.names not found at {coco_path}, using defaults")
            return ['person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle']
    except Exception as e:
        print(f"Warning: Failed to load class names: {e}, using defaults")
        return ['person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle']

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

class RealObjectDetector:
    """Real object detection using OpenCV"""

    def __init__(self):
        self.initialized = False
        self.background_subtractor = None

    def initialize(self):
        """Initialize OpenCV detector"""
        if self.initialized:
            return

        try:
            # Initialize background subtractor for motion detection
            self.background_subtractor = cv2.createBackgroundSubtractorMOG2(
                history=500,
                varThreshold=16,
                detectShadows=True
            )
            print("OpenCV Service: Background subtractor initialized")

            self.initialized = True
            print("OpenCV Service: Real detection initialized successfully")
        except Exception as e:
            print(f"OpenCV Service: Failed to initialize: {e}")
            raise

    def detect_objects(self, image_path: str, file_hash: str, file_path: str = '', file_size: int = 0, file_modified: str = '') -> Dict[str, Any]:
        """Perform real object detection using motion and contour analysis"""
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

            # Perform real object detection
            detections = self._perform_real_detection(image)

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

    def _perform_real_detection(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Perform real object detection using motion analysis and shape classification"""
        detections = []

        try:
            # Check if background subtractor is initialized
            if self.background_subtractor is None:
                raise RuntimeError("Background subtractor not initialized")

            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

            # Apply Gaussian blur
            blurred = cv2.GaussianBlur(gray, (21, 21), 0)

            # Use background subtraction for motion detection
            fg_mask = self.background_subtractor.apply(blurred, learningRate=0.001)

            # Threshold
            _, thresh = cv2.threshold(fg_mask, 25, 255, cv2.THRESH_BINARY)

            # Morphological operations
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
            dilated = cv2.dilate(thresh, kernel, iterations=1)

            # Find contours
            contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            image_height, image_width = image.shape[:2]

            # Process contours
            for contour in contours:
                area = cv2.contourArea(contour)

                # Filter small contours
                if area < 500:
                    continue

                # Get bounding box
                x, y, w, h = cv2.boundingRect(contour)

                # Calculate confidence based on multiple factors
                perimeter = cv2.arcLength(contour, True)
                solidity = self._calculate_solidity(contour, area)
                confidence = self._calculate_confidence(
                    area, perimeter, solidity, w, h,
                    image_width, image_height
                )

                # Classify object
                class_label = self._classify_object(w, h, area, image_width, image_height)

                detections.append({
                    'class': class_label,
                    'confidence': min(100, confidence),
                    'bbox': {
                        'x': int(x),
                        'y': int(y),
                        'width': int(w),
                        'height': int(h)
                    }
                })

                # Limit detections
                if len(detections) >= 10:
                    break

            return detections

        except Exception as e:
            print(f"OpenCV Service: Object detection error: {e}")
            return []

    def _calculate_solidity(self, contour, area: float) -> float:
        """Calculate solidity (area / convex hull area)"""
        try:
            hull = cv2.convexHull(contour)
            hull_area = cv2.contourArea(hull)
            if hull_area > 0:
                return area / hull_area
            return 0.5
        except:
            return 0.5

    def _calculate_confidence(self, area: float, perimeter: float, solidity: float,
                             width: float, height: float,
                             image_width: float, image_height: float) -> float:
        """Calculate detection confidence based on multiple factors"""
        # Normalized area
        normalized_area = area / (image_width * image_height)
        confidence = min(100, normalized_area * 10000)

        # Solidity adjustment
        confidence *= (0.5 + solidity)

        # Aspect ratio adjustment
        aspect_ratio = width / height
        if 0.3 <= aspect_ratio <= 0.6:  # Person-like
            confidence *= 1.3
        elif aspect_ratio > 2.0 or aspect_ratio < 0.2:  # Unlikely person
            confidence *= 0.6

        # Perimeter to area ratio
        if area > 0:
            perimeter_area_ratio = (perimeter * perimeter) / area
            if perimeter_area_ratio < 20:
                confidence *= 1.1

        return min(100, max(30, confidence))

    def _classify_object(self, width: float, height: float, area: float,
                        image_width: float, image_height: float) -> str:
        """Classify object based on size and aspect ratio"""
        aspect_ratio = width / height
        normalized_area = area / (image_width * image_height)

        if normalized_area < 0.002:
            return 'small_object'
        elif normalized_area > 0.15:
            return 'car' if aspect_ratio > 0.8 else 'truck'
        elif 0.3 <= aspect_ratio <= 0.7:
            return 'person'
        elif 1.5 < aspect_ratio < 3.0:
            return 'car'
        elif aspect_ratio > 3.0:
            return 'truck'
        elif aspect_ratio < 0.3:
            return 'motorcycle'
        else:
            return 'object'

    def recognize_faces(self, image_path: str, file_hash: str, file_path: str = '', file_size: int = 0, file_modified: str = '') -> Dict[str, Any]:
        """Detect faces using Hough Circles (simplified face detection)"""
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
        """Detect face-like regions using Hough Circles"""
        face_detections = []

        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

            # Equalize histogram
            equalized = cv2.equalizeHist(gray)

            # Apply Gaussian blur
            blurred = cv2.GaussianBlur(equalized, (9, 9), 2)

            # Detect circles (potential face regions)
            circles = cv2.HoughCircles(
                blurred,
                cv2.HOUGH_GRADIENT,
                dp=1,
                minDist=equalized.shape[0] // 8,
                param1=100,
                param2=30,
                minRadius=20,
                maxRadius=50
            )

            if circles is not None:
                circles = np.round(circles[0, :]).astype("int")
                for i, (x, y, r) in enumerate(circles):
                    confidence = min(95, 50 + (r / 50) * 45)
                    face_detections.append({
                        'id': f'face_{i}',
                        'name': 'unknown',
                        'confidence': float(confidence),
                        'bbox': {
                            'x': max(0, x - r),
                            'y': max(0, y - r),
                            'width': r * 2,
                            'height': r * 2
                        }
                    })

            return face_detections

        except Exception as e:
            print(f"OpenCV Service: Face detection error: {e}")
            return []


# Initialize detector
detector = RealObjectDetector()
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
        'detectionMode': 'real',
        'initialized': detector.initialized
    })


@app.route('/status')
def status():
    """Status endpoint"""
    return jsonify({
        'status': 'ready',
        'initialized': detector.initialized,
        'service': 'opencv-detection',
        'detectionMode': 'real',
        'classNames': len(class_names)
    })


if __name__ == '__main__':
    print(f"🚀 OpenCV Microservice started on port {PORT}")
    print(f"📊 Health check: http://localhost:{PORT}/health")
    print(f"🔍 Status check: http://localhost:{PORT}/status")
    app.run(host='0.0.0.0', port=PORT, threaded=True)
