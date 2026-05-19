#!/usr/bin/env python3
"""
Improved Face Recognition Module using deep learning
Supports both face_recognition library and OpenCV DNN
"""

import cv2
import numpy as np
import os
import pickle
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any

class ImprovedFaceRecognition:
    """
    Improved face recognition using multiple methods:
    1. DNN-based face detection (OpenCV)
    2. Face recognition library (face_recognition) if available
    3. Fallback to Haar cascade
    """
    
    def __init__(self):
        self.known_faces_dir = os.path.join(os.path.dirname(__file__), 'known_faces')
        self.models_dir = os.path.join(os.path.dirname(__file__), 'models')
        self.embeddings_path = os.path.join(self.models_dir, 'face_embeddings_improved.pkl')
        self.labels_path = os.path.join(self.models_dir, 'face_labels_improved.pkl')
        
        # Create directories
        Path(self.known_faces_dir).mkdir(parents=True, exist_ok=True)
        Path(self.models_dir).mkdir(parents=True, exist_ok=True)
        
        # Detection methods
        self.use_face_recognition_lib = self._check_face_recognition_lib()
        self.dnn_face_detector = None
        self.haar_detector = None
        
        # Recognition data
        self.known_encodings = []
        self.known_names = []
        self.is_trained = False
        
        # Initialize detectors
        self._initialize_detectors()
        
        # Load trained model if exists
        self._load_trained_model()
    
    def _check_face_recognition_lib(self) -> bool:
        """Check if face_recognition library is available"""
        try:
            import face_recognition
            print("Improved Face Recognition: Using face_recognition library for high accuracy")
            return True
        except ImportError:
            print("Improved Face Recognition: face_recognition library not available, using OpenCV DNN")
            return False
    
    def _initialize_detectors(self):
        """Initialize face detectors"""
        # Try to load DNN face detector (best accuracy)
        try:
            prototxt_path = os.path.join(self.models_dir, 'deploy.prototxt')
            model_path = os.path.join(self.models_dir, 'res10_300x300_ssd_iter_140000_fp16.caffemodel')
            
            if os.path.exists(prototxt_path) and os.path.exists(model_path):
                self.dnn_face_detector = cv2.dnn.readNetFromCaffe(prototxt_path, model_path)
                print("Improved Face Recognition: DNN face detector loaded")
            else:
                print("Improved Face Recognition: DNN models not found, will use Haar cascade")
        except Exception as e:
            print(f"Improved Face Recognition: Failed to load DNN detector: {e}")
        
        # Always load Haar cascade as fallback
        try:
            self.haar_detector = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            if not self.haar_detector.empty():
                print("Improved Face Recognition: Haar cascade detector loaded as fallback")
        except Exception as e:
            print(f"Improved Face Recognition: Failed to load Haar cascade: {e}")
    
    def _load_trained_model(self):
        """Load previously trained face recognition model"""
        try:
            if os.path.exists(self.embeddings_path) and os.path.exists(self.labels_path):
                with open(self.embeddings_path, 'rb') as f:
                    self.known_encodings = pickle.load(f)
                with open(self.labels_path, 'rb') as f:
                    self.known_names = pickle.load(f)
                self.is_trained = True
                print(f"Improved Face Recognition: Loaded {len(self.known_names)} known faces")
        except Exception as e:
            print(f"Improved Face Recognition: Failed to load trained model: {e}")
    
    def detect_faces(self, image: np.ndarray, method: str = 'auto') -> List[Dict[str, Any]]:
        """
        Detect faces in an image
        
        Args:
            image: Input image (BGR format)
            method: 'auto', 'dnn', 'haar', or 'face_recognition'
        
        Returns:
            List of face detections with bounding boxes
        """
        faces = []
        
        # Choose detection method
        if method == 'auto':
            if self.use_face_recognition_lib:
                method = 'face_recognition'
            elif self.dnn_face_detector is not None:
                method = 'dnn'
            else:
                method = 'haar'
        
        try:
            if method == 'face_recognition' and self.use_face_recognition_lib:
                faces = self._detect_with_face_recognition_lib(image)
            elif method == 'dnn' and self.dnn_face_detector is not None:
                faces = self._detect_with_dnn(image)
            elif method == 'haar' and self.haar_detector is not None:
                faces = self._detect_with_haar(image)
            else:
                # Try all methods
                if self.dnn_face_detector is not None:
                    faces = self._detect_with_dnn(image)
                elif self.haar_detector is not None:
                    faces = self._detect_with_haar(image)
        except Exception as e:
            print(f"Improved Face Recognition: Detection error: {e}")
        
        return faces
    
    def _detect_with_face_recognition_lib(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Detect faces using face_recognition library (best accuracy)"""
        import face_recognition
        
        # Convert BGR to RGB
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Detect faces
        face_locations = face_recognition.face_locations(rgb_image, model='hog')  # Lighter than CNN
        
        faces = []
        for (top, right, bottom, left) in face_locations:
            faces.append({
                'x': int(left),
                'y': int(top),
                'width': int(right - left),
                'height': int(bottom - top),
                'method': 'face_recognition',
                'confidence': 0.95  # High confidence for this method
            })
        
        return faces
    
    def _detect_with_dnn(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Detect faces using OpenCV DNN model"""
        h, w = image.shape[:2]
        
        # Preprocess image
        blob = cv2.dnn.blobFromImage(
            cv2.resize(image, (300, 300)), 
            1.0, 
            (300, 300), 
            (104.0, 177.0, 123.0)
        )
        
        # Run detection
        self.dnn_face_detector.setInput(blob)
        detections = self.dnn_face_detector.forward()
        
        faces = []
        for i in range(detections.shape[2]):
            confidence = float(detections[0, 0, i, 2])
            
            # Filter by confidence (lowered for low-res security camera images)
            if confidence > 0.15:
                # Get bounding box
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                x, y, x1, y1 = box.astype(int)
                
                # Ensure within bounds
                x = max(0, x)
                y = max(0, y)
                x1 = min(w, x1)
                y1 = min(h, y1)
                
                faces.append({
                    'x': int(x),
                    'y': int(y),
                    'width': int(x1 - x),
                    'height': int(y1 - y),
                    'method': 'dnn',
                    'confidence': round(confidence * 100, 2)
                })
        
        return faces
    
    def _detect_with_haar(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Detect faces using Haar cascade (fastest, less accurate)"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces_rects = self.haar_detector.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30),
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        
        faces = []
        for (x, y, w, h) in faces_rects:
            faces.append({
                'x': int(x),
                'y': int(y),
                'width': int(w),
                'height': int(h),
                'method': 'haar',
                'confidence': 0.70  # Moderate confidence
            })
        
        return faces
    
    def extract_face_embedding(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        """
        Extract face embedding for recognition
        
        Args:
            face_image: Face region image
        
        Returns:
            Face embedding vector or None
        """
        try:
            if self.use_face_recognition_lib:
                import face_recognition
                
                # Convert BGR to RGB
                rgb_face = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
                
                # Resize for consistency
                rgb_face = cv2.resize(rgb_face, (150, 150))
                
                # Get face encoding
                encodings = face_recognition.face_encodings(rgb_face, num_jitters=1)
                
                if len(encodings) > 0:
                    return encodings[0]
            
            # Fallback: Use simple feature extraction
            # Resize to standard size
            face_resized = cv2.resize(face_image, (100, 100))
            
            # Convert to grayscale
            gray = cv2.cvtColor(face_resized, cv2.COLOR_BGR2GRAY)
            
            # Use histogram as simple features
            hist = cv2.calcHist([gray], [0], None, [32], [0, 256])
            hist = cv2.normalize(hist, hist).flatten()
            
            return hist
            
        except Exception as e:
            print(f"Improved Face Recognition: Embedding extraction error: {e}")
            return None
    
    def recognize_face(self, face_image: np.ndarray, tolerance: float = 0.6) -> Tuple[str, float]:
        """
        Recognize a face
        
        Args:
            face_image: Face region image
            tolerance: Recognition tolerance (lower = more strict)
        
        Returns:
            Tuple of (name, confidence)
        """
        if not self.is_trained or len(self.known_encodings) == 0:
            return "unknown", 0.0
        
        try:
            # Extract embedding
            embedding = self.extract_face_embedding(face_image)
            if embedding is None:
                return "unknown", 0.0
            
            if self.use_face_recognition_lib:
                # Use face_recognition library for matching
                import face_recognition
                
                # Compare with known faces
                matches = face_recognition.compare_faces(
                    self.known_encodings, 
                    embedding, 
                    tolerance=tolerance
                )
                
                # Calculate face distances
                face_distances = face_recognition.face_distance(self.known_encodings, embedding)
                
                if True in matches:
                    # Find best match
                    best_match_index = np.argmin(face_distances)
                    name = self.known_names[best_match_index]
                    
                    # Convert distance to confidence score
                    distance = face_distances[best_match_index]
                    confidence = max(0, min(100, (1.0 - distance) * 100))
                    
                    return name, round(confidence, 2)
                
                return "unknown", 0.0
            else:
                # Use simple Euclidean distance matching
                distances = []
                for known_encoding in self.known_encodings:
                    # Handle different embedding sizes
                    if embedding.shape == known_encoding.shape:
                        distance = np.linalg.norm(embedding - known_encoding)
                    else:
                        # Resize for comparison
                        embedding_resized = cv2.resize(embedding, (len(known_encoding),))
                        distance = np.linalg.norm(embedding_resized - known_encoding)
                    distances.append(distance)
                
                if distances:
                    min_distance = min(distances)
                    min_index = np.argmin(distances)
                    
                    if min_distance < tolerance:
                        name = self.known_names[min_index]
                        confidence = max(0, min(100, (1.0 - min_distance / tolerance) * 100))
                        return name, round(confidence, 2)
                
                return "unknown", 0.0
                
        except Exception as e:
            print(f"Improved Face Recognition: Recognition error: {e}")
            return "unknown", 0.0
    
    def train_recognizer(self):
        """Train the face recognizer with known faces"""
        try:
            faces = []
            names = []
            
            print("Improved Face Recognition: Training face recognizer...")
            
            for person_dir in os.listdir(self.known_faces_dir):
                person_path = os.path.join(self.known_faces_dir, person_dir)
                if not os.path.isdir(person_path):
                    continue
                
                print(f"  Processing: {person_dir}")
                
                for image_file in os.listdir(person_path):
                    if image_file.lower().endswith(('.png', '.jpg', '.jpeg')):
                        image_path = os.path.join(person_path, image_file)
                        image = cv2.imread(image_path)
                        
                        if image is None:
                            continue
                        
                        # Direct face detection using face_recognition library
                        import face_recognition as fr_lib
                        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                        face_locs = fr_lib.face_locations(rgb_image, model='hog')
                        
                        if not face_locs:
                            continue
                            
                        for face_rect in face_locs:
                            top, right, bottom, left = face_rect
                            x, y = left, top
                            w, h = right - left, bottom - top
                            
                            face_roi = image[y:y+h, x:x+w]
                            
                            # Skip small faces
                            if w < 50 or h < 50:
                                continue
                            
                            # Extract face features
                            embedding = self.extract_face_embedding(face_roi)
                            if embedding is not None:
                                faces.append(embedding)
                                names.append(person_dir)
            
            if faces:
                self.known_encodings = faces
                self.known_names = names
                self.is_trained = True
                
                # Save model
                with open(self.embeddings_path, 'wb') as f:
                    pickle.dump(self.known_encodings, f)
                with open(self.labels_path, 'wb') as f:
                    pickle.dump(self.known_names, f)
                
                print(f"Improved Face Recognition: Trained with {len(faces)} faces from {len(set(names))} people")
            else:
                print("Improved Face Recognition: No training data found")
        
        except Exception as e:
            print(f"Improved Face Recognition: Training error: {e}")
    
    def detect_and_recognize(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect and recognize faces in an image
        
        Args:
            image: Input image
        
        Returns:
            List of face detections with recognition results
        """
        results = []
        
        # Detect faces
        faces = self.detect_faces(image)
        
        for i, face in enumerate(faces):
            # Extract face region
            x, y = face['x'], face['y']
            w, h = face['width'], face['height']
            
            # Ensure within bounds
            x = max(0, min(x, image.shape[1]))
            y = max(0, min(y, image.shape[0]))
            w = min(w, image.shape[1] - x)
            h = min(h, image.shape[0] - y)
            
            if w <= 0 or h <= 0:
                continue
            
            face_roi = image[y:y+h, x:x+w]
            
            # Recognize face
            name, confidence = self.recognize_face(face_roi)
            
            results.append({
                'id': f'face_{i}',
                'name': name,
                'confidence': confidence,
                'isKnown': name != 'unknown',
                'bbox': {
                    'x': int(x),
                    'y': int(y),
                    'width': int(w),
                    'height': int(h)
                },
                'detection_method': face.get('method', 'unknown')
            })
        
        return results

# Singleton instance
improved_face_recognizer = ImprovedFaceRecognition()

if __name__ == "__main__":
    print("Improved Face Recognition module loaded")
    print(f"Using face_recognition library: {improved_face_recognizer.use_face_recognition_lib}")
    print(f"DNN detector available: {improved_face_recognizer.dnn_face_detector is not None}")
