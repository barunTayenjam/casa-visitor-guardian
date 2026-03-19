#!/usr/bin/env python3
"""
Face Embedding Quality Analyzer
Computes quality metrics for face embeddings
"""

import cv2
import numpy as np
from typing import Dict, Any

class EmbeddingQualityAnalyzer:
    """Analyzes face image quality for embedding storage"""

    def __init__(self):
        self.min_face_size = 80  # Minimum face size in pixels
        self.min_quality_score = 50  # Minimum quality score (0-100)

    def analyze_face_quality(self, image: np.ndarray, face_bbox: Dict[str, Any],
                            detection_confidence: float) -> Dict[str, Any]:
        """
        Analyze face image quality

        Args:
            image: Full image
            face_bbox: Face bounding box {x, y, width, height}
            detection_confidence: Face detection confidence (0-100)

        Returns:
            Quality metrics dictionary
        """
        x, y, w, h = face_bbox['x'], face_bbox['y'], face_bbox['width'], face_bbox['height']

        # Extract face ROI
        face_roi = image[y:y+h, x:x+w]

        # Calculate quality metrics
        sharpness = self._calculate_sharpness(face_roi)
        brightness = self._calculate_brightness(face_roi)
        face_area = w * h
        face_confidence = detection_confidence

        # Calculate overall quality score (0-100)
        quality_score = self._calculate_quality_score(
            sharpness, brightness, w, h, face_confidence
        )

        return {
            'sharpness': round(sharpness, 2),
            'brightness': round(brightness, 2),
            'face_width': w,
            'face_height': h,
            'face_area': face_area,
            'face_confidence': round(face_confidence, 2),
            'quality_score': round(quality_score, 2)
        }

    def _calculate_sharpness(self, face_roi: np.ndarray) -> float:
        """Calculate sharpness using Laplacian variance"""
        try:
            gray = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            variance = laplacian.var()

            # Normalize to 0-100 scale
            # Good sharpness typically > 100 variance
            sharpness = min(100, (variance / 200) * 100)
            return max(0, sharpness)
        except Exception as e:
            print(f"Sharpness calculation error: {e}")
            return 50.0  # Default average sharpness

    def _calculate_brightness(self, face_roi: np.ndarray) -> float:
        """Calculate average brightness (0-255)"""
        try:
            gray = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
            brightness = gray.mean()
            return round(float(brightness), 2)
        except Exception as e:
            print(f"Brightness calculation error: {e}")
            return 128.0  # Default mid-level brightness

    def _calculate_quality_score(self, sharpness: float, brightness: float,
                                 width: int, height: int,
                                 confidence: float) -> float:
        """
        Calculate overall quality score (0-100)

        Weights:
        - Sharpness: 30%
        - Brightness: 20% (optimal range 100-180)
        - Face size: 25% (minimum 80x80)
        - Detection confidence: 25%
        """
        # Sharpness score (0-100)
        sharpness_score = min(100, sharpness)

        # Brightness score (optimal range 100-180)
        brightness_score = 100
        if brightness < 100:
            brightness_score = (brightness / 100) * 100
        elif brightness > 180:
            brightness_score = max(0, 100 - ((brightness - 180) / 75) * 100)

        # Face size score (minimum 80x80)
        min_dimension = min(width, height)
        size_score = min(100, (min_dimension / self.min_face_size) * 100)

        # Detection confidence score (0-100)
        confidence_score = confidence

        # Weighted average
        quality_score = (
            sharpness_score * 0.30 +
            brightness_score * 0.20 +
            size_score * 0.25 +
            confidence_score * 0.25
        )

        return round(quality_score, 2)

    def is_quality_acceptable(self, quality_metrics: Dict[str, Any]) -> bool:
        """Check if quality meets minimum threshold"""
        return quality_metrics['quality_score'] >= self.min_quality_score


# Singleton instance
quality_analyzer = EmbeddingQualityAnalyzer()
