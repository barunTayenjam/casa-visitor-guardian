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
        """Detect faces using face_recognition library"""
        try:
            import face_recognition
            # Convert BGR to RGB
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            # Detect faces
            face_locations = face_recognition.face_locations(rgb_image, model='hog')
            
            faces = []
            for (top, right, bottom, left) in face_locations:
                faces.append({
                    'x': int(left),
                    'y': int(top),
                    'width': int(right - left),
                    'height': int(bottom - top),
                    'method': 'face_recognition',
                    'confidence': 95.0
                })
            return faces
        except ImportError:
            return []
    
    def _detect_with_dnn(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Detect faces using OpenCV DNN model"""
        h, w = image.shape[:2]
        blob = cv2.dnn.blobFromImage(cv2.resize(image, (300, 300)), 1.0, (300, 300), (104.0, 177.0, 123.0))
        self.dnn_face_detector.setInput(blob)
        detections = self.dnn_face_detector.forward()
        
        faces = []
        for i in range(detections.shape[2]):
            confidence = float(detections[0, 0, i, 2])
            if confidence > 0.15:
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                x, y, x1, y1 = box.astype(int)
                x, y = max(0, x), max(0, y)
                x1, y1 = min(w, x1), min(h, y1)
                
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
        """Detect faces using Haar cascade"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces_rects = self.haar_detector.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))
        
        faces = []
        for (x, y, w, h) in faces_rects:
            faces.append({
                'x': int(x),
                'y': int(y),
                'width': int(w),
                'height': int(h),
                'method': 'haar',
                'confidence': 70.0
            })
        return faces
    
    def extract_face_embedding(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        """Extract face embedding for recognition"""
        try:
            if self.use_face_recognition_lib:
                try:
                    import face_recognition
                    rgb_face = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
                    rgb_face = cv2.resize(rgb_face, (150, 150))
                    encodings = face_recognition.face_encodings(rgb_face, num_jitters=1)
                    if len(encodings) > 0:
                        return encodings[0]
                except ImportError:
                    pass
            
            # Fallback: Use simple feature extraction
            face_resized = cv2.resize(face_image, (100, 100))
            gray = cv2.cvtColor(face_resized, cv2.COLOR_BGR2GRAY)
            hist = cv2.calcHist([gray], [0], None, [32], [0, 256])
            hist = cv2.normalize(hist, hist).flatten()
            return hist
        except Exception as e:
            print(f"Improved Face Recognition: Embedding extraction error: {e}")
            return None
    
    def recognize_face(self, face_image: np.ndarray, tolerance: float = 0.6) -> Tuple[str, float]:
        """Recognize a face"""
        if not self.is_trained or len(self.known_encodings) == 0:
            return "unknown", 0.0
        
        try:
            embedding = self.extract_face_embedding(face_image)
            if embedding is None:
                return "unknown", 0.0
            
            if self.use_face_recognition_lib:
                try:
                    import face_recognition
                    matches = face_recognition.compare_faces(self.known_encodings, embedding, tolerance=tolerance)
                    face_distances = face_recognition.face_distance(self.known_encodings, embedding)
                    
                    if True in matches:
                        best_match_index = np.argmin(face_distances)
                        name = self.known_names[best_match_index]
                        distance = face_distances[best_match_index]
                        confidence = max(0, min(100, (1.0 - distance) * 100))
                        return name, round(confidence, 2)
                except ImportError:
                    pass
            
            # Simple Euclidean distance matching
            distances = []
            for known_encoding in self.known_encodings:
                if embedding.shape == known_encoding.shape:
                    distance = np.linalg.norm(embedding - known_encoding)
                else:
                    embedding_resized = np.interp(
                        np.linspace(0, len(embedding), len(known_encoding)),
                        np.arange(len(embedding)),
                        embedding
                    )
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
                        
                        # Use general detect_faces method (handles missing library)
                        face_detections = self.detect_faces(image)
                        
                        for face in face_detections:
                            x, y, w, h = face['x'], face['y'], face['width'], face['height']
                            face_roi = image[y:y+h, x:x+w]
                            
                            if w < 50 or h < 50:
                                continue
                            
                            embedding = self.extract_face_embedding(face_roi)
                            if embedding is not None:
                                faces.append(embedding)
                                names.append(person_dir)
            
            if faces:
                self.known_encodings = faces
                self.known_names = names
                self.is_trained = True
                with open(self.embeddings_path, 'wb') as f:
                    pickle.dump(self.known_encodings, f)
                with open(self.labels_path, 'wb') as f:
                    pickle.dump(self.known_names, f)
                print(f"Improved Face Recognition: Trained with {len(faces)} faces from {len(set(names))} people")
            else:
                print("Improved Face Recognition: No training data found")
        except Exception as e:
            print(f"Improved Face Recognition: Training error: {e}")
    
    def _detect_faces(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Detect and recognize faces in an image"""
        results = []
        faces = self.detect_faces(image)
        for i, face in enumerate(faces):
            x, y, w, h = face['x'], face['y'], face['width'], face['height']
            x, y = max(0, min(x, image.shape[1])), max(0, min(y, image.shape[0]))
            w, h = min(w, image.shape[1] - x), min(h, image.shape[0] - y)
            if w <= 0 or h <= 0: continue
            
            face_roi = image[y:y+h, x:x+w]
            name, confidence = self.recognize_face(face_roi)
            results.append({
                'id': f'face_{i}',
                'name': name,
                'confidence': confidence,
                'isKnown': name != 'unknown',
                'bbox': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)},
                'detection_method': face.get('method', 'unknown')
            })
        return results

# Singleton instance
improved_face_recognizer = ImprovedFaceRecognition()

if __name__ == "__main__":
    print("Improved Face Recognition module loaded")
    print(f"Using face_recognition library: {improved_face_recognizer.use_face_recognition_lib}")
    print(f"DNN detector available: {improved_face_recognizer.dnn_face_detector is not None}")
