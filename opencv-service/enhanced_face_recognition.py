#!/usr/bin/env python3
"""
Enhanced face recognition using deep learning models
"""

import cv2
import numpy as np
import os
import pickle
from pathlib import Path

class EnhancedFaceRecognition:
    """
    Enhanced face recognition using deep learning models
    """
    
    def __init__(self):
        self.known_faces_dir = os.path.join(os.path.dirname(__file__), 'known_faces')
        self.models_dir = os.path.join(os.path.dirname(__file__), 'models')
        self.model_path = os.path.join(self.models_dir, 'enhanced_face_recognizer.pkl')
        self.embeddings_path = os.path.join(self.models_dir, 'face_embeddings.pkl')
        self.labels_path = os.path.join(self.models_dir, 'face_labels.pkl')
        
        # Create directories if they don't exist
        Path(self.known_faces_dir).mkdir(parents=True, exist_ok=True)
        Path(self.models_dir).mkdir(parents=True, exist_ok=True)
        
        # Initialize face detection and recognition models
        self.face_detector = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        # Try to load DNN face detector for better accuracy
        self.dnn_face_detector = self._load_dnn_face_detector()
        
        # Initialize face embeddings model (using OpenCV's DNN face recognition)
        self.face_embeddings_model = self._load_face_embeddings_model()
        
        # Load trained model if it exists
        self.known_encodings = []
        self.known_names = []
        self.is_trained = False
        self._load_trained_model()
    
    def _load_dnn_face_detector(self):
        """Load DNN-based face detector for better accuracy"""
        try:
            # Try to load a DNN face detection model
            # This is a placeholder - in a real implementation, you'd download the model files
            prototxt_path = os.path.join(self.models_dir, 'deploy.prototxt')
            model_path = os.path.join(self.models_dir, 'res10_300x300_ssd_iter_140000_fp16.caffemodel')
            
            if os.path.exists(prototxt_path) and os.path.exists(model_path):
                net = cv2.dnn.readNetFromCaffe(prototxt_path, model_path)
                return net
            else:
                print("DNN face detector model files not found, using Haar cascade")
                return None
        except Exception as e:
            print(f"Failed to load DNN face detector: {e}")
            return None
    
    def _load_face_embeddings_model(self):
        """Load face embeddings model for better recognition"""
        try:
            # Placeholder for loading face embedding model
            # In a real implementation, this could be a DNN model like ArcFace
            return None
        except Exception as e:
            print(f"Failed to load face embeddings model: {e}")
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
        """Extract features from face image using deep learning model"""
        try:
            # Convert to RGB (OpenCV uses BGR)
            rgb_face = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
            
            # Resize to standard size for the model
            resized_face = cv2.resize(rgb_face, (224, 224))
            
            # Normalize pixel values
            normalized_face = resized_face.astype(np.float32) / 255.0
            
            # In a real implementation, we would pass this through a neural network
            # For now, we'll use a simplified approach
            return np.mean(normalized_face, axis=(0, 1))  # Simple feature extraction
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
                
                # Convert distance to similarity score (lower distance = higher similarity)
                # Using a threshold to determine if it's a known face
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
    
    def detect_and_recognize_faces(self, image):
        """Detect and recognize faces in an image"""
        # Detect faces
        faces = self.detect_faces_dnn(image)
        
        results = []
        for i, (x, y, w, h) in enumerate(faces):
            # Extract face region
            face_roi = image[y:y+h, x:x+w]
            
            # Recognize the face
            name, confidence = self.recognize_face(face_roi)
            
            results.append({
                'id': f'face_{i}',
                'name': name,
                'confidence': float(confidence),
                'isKnown': name != 'unknown',
                'bbox': {
                    'x': int(x),
                    'y': int(y),
                    'width': int(w),
                    'height': int(h)
                }
            })
        
        return results

# Example usage
if __name__ == "__main__":
    # This would be integrated into the main app.py
    recognizer = EnhancedFaceRecognition()
    print("Enhanced face recognition model initialized")