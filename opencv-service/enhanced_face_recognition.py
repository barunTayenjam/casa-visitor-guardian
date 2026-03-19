#!/usr/bin/env python3
"""
Enhanced Face Recognition with Cosine Similarity
"""

import cv2
import numpy as np
import pickle
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from cosine_similarity import cosine_similarity, find_best_match, similarity_to_confidence
from embedding_quality_analyzer import quality_analyzer

class EnhancedFaceRecognition:
    """
    Enhanced face recognition using cosine similarity
    """

    def __init__(self):
        self.known_faces_dir = os.path.join(os.path.dirname(__file__), 'known_faces')
        self.models_dir = os.path.join(os.path.dirname(__file__), 'models')
        self.embeddings_path = os.path.join(self.models_dir, 'face_embeddings_enhanced.pkl')
        self.labels_path = os.path.join(self.models_dir, 'face_labels_enhanced.pkl')

        # Recognition configuration
        self.config = {
            'similarity_threshold': 0.6,
            'min_face_quality': 60,
            'max_embeddings_per_visitor': 10,
            'comparison_algorithm': 'cosine'
        }

        # Create directories
        Path(self.known_faces_dir).mkdir(parents=True, exist_ok=True)
        Path(self.models_dir).mkdir(parents=True, exist_ok=True)

        # Recognition data
        self.known_embeddings = []  # List of embeddings
        self.known_names = []  # List of names
        self.known_metadata = []  # List of metadata dicts
        self.is_trained = False

        # Load configuration and model
        self._load_config()
        self._load_trained_model()

    def _load_config(self):
        """Load configuration from backend API"""
        try:
            import requests
            backend_url = os.environ.get('BACKEND_URL', 'http://backend:9753')

            response = requests.get(f'{backend_url}/api/face-config', timeout=2)
            if response.status_code == 200:
                config = response.json()

                # Update configuration
                if 'similarity_threshold' in config:
                    self.config['similarity_threshold'] = config['similarity_threshold'].value
                if 'min_face_quality' in config:
                    self.config['min_face_quality'] = config['min_face_quality'].value
                if 'max_embeddings_per_visitor' in config:
                    self.config['max_embeddings_per_visitor'] = config['max_embeddings_per_visitor'].value
                if 'comparison_algorithm' in config:
                    self.config['comparison_algorithm'] = config['comparison_algorithm'].algorithm

                print(f"Enhanced Face Recognition: Loaded config - threshold={self.config['similarity_threshold']}")
        except Exception as e:
            print(f"Enhanced Face Recognition: Using default config - {e}")

    def _load_trained_model(self):
        """Load previously trained face recognition model"""
        try:
            if os.path.exists(self.embeddings_path) and os.path.exists(self.labels_path):
                with open(self.embeddings_path, 'rb') as f:
                    self.known_embeddings = pickle.load(f)
                with open(self.labels_path, 'rb') as f:
                    self.known_names = pickle.load(f)

                # Load metadata if exists
                metadata_path = os.path.join(self.models_dir, 'face_metadata_enhanced.pkl')
                if os.path.exists(metadata_path):
                    with open(metadata_path, 'rb') as f:
                        self.known_metadata = pickle.load(f)
                else:
                    # Create empty metadata
                    self.known_metadata = [{'quality': 100} for _ in self.known_names]

                self.is_trained = True
                print(f"Enhanced Face Recognition: Loaded {len(self.known_names)} known faces")
        except Exception as e:
            print(f"Enhanced Face Recognition: Failed to load model - {e}")

    def extract_face_embedding(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        """Extract face embedding for recognition"""
        try:
            import face_recognition

            # Convert BGR to RGB
            rgb_face = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)

            # Resize for consistency
            rgb_face = cv2.resize(rgb_face, (150, 150))

            # Get face encoding (128-dimensional vector)
            encodings = face_recognition.face_encodings(rgb_face, num_jitters=1)

            if len(encodings) > 0:
                return encodings[0]

            return None

        except ImportError:
            print("face_recognition library not available")
            return None
        except Exception as e:
            print(f"Enhanced Face Recognition: Embedding extraction error - {e}")
            return None

    def recognize_face(
        self,
        face_image: np.ndarray,
        full_image: Optional[np.ndarray] = None,
        face_bbox: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, float, Dict[str, Any]]:
        """
        Recognize a face using cosine similarity

        Args:
            face_image: Face region image
            full_image: Full image (for quality analysis)
            face_bbox: Face bounding box (for quality analysis)

        Returns:
            Tuple of (name, confidence, metadata)
        """
        if not self.is_trained or len(self.known_embeddings) == 0:
            return "unknown", 0.0, {'method': 'no_model', 'quality': 0}

        try:
            # Extract embedding
            embedding = self.extract_face_embedding(face_image)
            if embedding is None:
                return "unknown", 0.0, {'method': 'extraction_failed', 'quality': 0}

            # Analyze quality if metadata provided
            quality_score = 100
            if full_image is not None and face_bbox is not None:
                quality_metrics = quality_analyzer.analyze_face_quality(
                    full_image, face_bbox, 95.0
                )
                quality_score = quality_metrics['quality_score']

            # Filter embeddings by quality
            min_quality = self.config['min_face_quality']
            filtered_embeddings = []
            filtered_names = []

            for i, (emb, name, meta) in enumerate(zip(
                self.known_embeddings,
                self.known_names,
                self.known_metadata
            )):
                if meta.get('quality', 0) >= min_quality:
                    filtered_embeddings.append(emb)
                    filtered_names.append(name)

            if not filtered_embeddings:
                return "unknown", 0.0, {
                    'method': 'no_quality_embeddings',
                    'quality': quality_score
                }

            # Find best match using cosine similarity
            threshold = self.config['similarity_threshold']
            best_index, similarity, is_match = find_best_match(
                embedding, filtered_embeddings, threshold
            )

            if is_match and best_index is not None:
                # Match found
                name = filtered_names[best_index]
                confidence = similarity_to_confidence(similarity)

                return name, confidence, {
                    'method': 'cosine',
                    'similarity': round(similarity, 4),
                    'threshold': threshold,
                    'quality': quality_score
                }
            else:
                # No match above threshold
                best_similarity = similarity if similarity is not None else 0.0
                confidence = similarity_to_confidence(best_similarity)

                return "unknown", confidence, {
                    'method': 'cosine',
                    'similarity': round(best_similarity, 4),
                    'threshold': threshold,
                    'quality': quality_score,
                    'reason': 'below_threshold'
                }

        except Exception as e:
            print(f"Enhanced Face Recognition: Recognition error - {e}")
            return "unknown", 0.0, {'method': 'error', 'error': str(e)}


# Singleton instance
enhanced_face_recognizer = EnhancedFaceRecognition()

if __name__ == "__main__":
    print("Enhanced Face Recognition module loaded")
    print(f"Similarity threshold: {enhanced_face_recognizer.config['similarity_threshold']}")
    print(f"Trained: {enhanced_face_recognizer.is_trained}")
