import os
import cv2
import numpy as np
from typing import List, Dict

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')


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


def draw_detections(image: np.ndarray, detections: List[Dict]) -> np.ndarray:
    try:
        result = image.copy()

        colors = {
            'person': (0, 255, 0),
            'car': (255, 0, 0),
            'truck': (200, 0, 0),
            'motorcycle': (0, 128, 255),
            'bicycle': (255, 165, 0),
            'dog': (0, 165, 255),
            'cat': (128, 0, 128),
            'face': (255, 0, 255),
        }

        for detection in detections:
            bbox = detection.get('bbox', {})
            x = bbox.get('x', 0)
            y = bbox.get('y', 0)
            w = bbox.get('width', 0)
            h = bbox.get('height', 0)
            class_name = detection.get('class', 'object')
            confidence = detection.get('confidence', 0)

            color = colors.get(class_name.lower(), (0, 255, 255))

            cv2.rectangle(result, (x, y), (x + w, y + h), color, 2)

            label = f"{class_name}: {confidence}%"
            (label_width, label_height), _ = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1
            )
            cv2.rectangle(result, (x, y - label_height - 10), (x + label_width, y), color, -1)

            cv2.putText(
                result, label, (x, y - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1
            )

        return result

    except Exception as e:
        print(f"Error drawing detections: {e}")
        return image
