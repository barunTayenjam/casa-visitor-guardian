#!/usr/bin/env python3
"""
Batch detection script - detects objects/faces in images and updates database metadata
"""

import os
import sys
import json
import hashlib
import time
import cv2
import numpy as np
from datetime import datetime
from pathlib import Path

MODELS_DIR = os.path.join(os.path.dirname(__file__), '../opencv-service/models')
CACHE_DIR = os.path.join(os.path.dirname(__file__), '../opencv-service/data/cache')

DB_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'localhost'),
    'port': os.getenv('POSTGRES_PORT', '5432'),
    'dbname': os.getenv('POSTGRES_DB', 'sentryvision'),
    'user': os.getenv('POSTGRES_USER', 'sentryvision'),
    'password': os.getenv('POSTGRES_PASSWORD', 'sentryvision123')
}

def load_class_names():
    try:
        coco_path = os.path.join(MODELS_DIR, 'yolo_classes.txt')
        if os.path.exists(coco_path):
            with open(coco_path, 'r') as f:
                return f.read().strip().split('\n')
        return ['person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat']
    except Exception:
        return ['person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat']

class_names = load_class_names()

class YOLOObjectDetector:
    def __init__(self):
        self.net = None
        self.layer_names = None
        self.input_size = 416
        self.confidence_threshold = 0.5
        self.nms_threshold = 0.4
        self.initialize()

    def initialize(self):
        try:
            weights_path = os.path.join(MODELS_DIR, 'yolov4-tiny.weights')
            config_path = os.path.join(MODELS_DIR, 'yolov4-tiny.cfg')
            if os.path.exists(weights_path) and os.path.exists(config_path):
                self.net = cv2.dnn.readNet(weights_path, config_path)
                self.layer_names = self.net.getLayerNames()
                self.layer_names = [self.layer_names[i - 1] for i in self.net.getUnconnectedOutLayers()]
                print(f"Loaded YOLOv4-tiny model")
        except Exception as e:
            print(f"Failed to load YOLO model: {e}")

    def detect(self, image_path):
        start_time = time.time()
        try:
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Failed to read image: {image_path}")

            detections = []
            height, width = image.shape[:2]

            if self.net is not None:
                blob = cv2.dnn.blobFromImage(image, 1/255.0, (self.input_size, self.input_size), swapRB=True, crop=False)
                self.net.setInput(blob)
                outputs = self.net.forward(self.layer_names)

                boxes, confidences, class_ids = [], [], []
                for output in outputs:
                    for detection in output:
                        scores = detection[5:]
                        class_id = np.argmax(scores)
                        confidence = scores[class_id]
                        if confidence > self.confidence_threshold:
                            cx, cy, w, h = (detection[0:4] * [width, height, width, height]).astype(int)
                            boxes.append([cx - w//2, cy - h//2, w, h])
                            confidences.append(float(confidence))
                            class_ids.append(int(class_id))

                indices = cv2.dnn.NMSBoxes(boxes, confidences, self.confidence_threshold, self.nms_threshold)
                if len(indices) > 0:
                    for i in indices.flatten():
                        x, y, w, h = boxes[i]
                        class_name = class_names[class_id] if class_id < len(class_names) else f"object_{class_id}"
                        detections.append({
                            'class': class_name,
                            'confidence': round(min(100, confidences[i] * 100), 2),
                            'bbox': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)}
                        })
            else:
                hog = cv2.HOGDescriptor()
                hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
                rects, weights = hog.detectMultiScale(image, winStride=(8, 8), padding=(32, 32), scale=1.05)
                for (x, y, w, h), weight in zip(rects, weights):
                    detections.append({
                        'class': 'person',
                        'confidence': round(min(100, max(30, weight * 100)), 2),
                        'bbox': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)}
                    })

            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            for (x, y, w, h) in faces:
                detections.append({
                    'class': 'face',
                    'confidence': 80.0,
                    'bbox': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)}
                })

            processing_time = (time.time() - start_time) * 1000
            return {'success': True, 'detections': detections, 'processing_time_ms': round(processing_time, 2)}
        except Exception as e:
            return {'success': False, 'error': str(e), 'detections': [], 'processing_time_ms': 0}

def get_db_connection():
    try:
        import psycopg2
        return psycopg2.connect(**DB_CONFIG)
    except Exception as e:
        print(f"Database connection failed: {e}")
        return None

def update_file_metadata(conn, file_path, file_hash, detections, processing_time):
    try:
        with conn.cursor() as cur:
            metadata = {
                'detections': detections,
                'processing_time_ms': processing_time,
                'detected_at': datetime.utcnow().isoformat() + 'Z',
                'detection_types': list(set(d.get('class', 'unknown') for d in detections))
            }
            cur.execute("""
                UPDATE detection_files
                SET metadata = %s, updated_at = NOW()
                WHERE storage_path = %s OR file_hash = %s
            """, (json.dumps(metadata), file_path, file_hash))
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        print(f"Error updating metadata: {e}")
        conn.rollback()
        return False

def process_images(image_paths):
    detector = YOLOObjectDetector()
    conn = get_db_connection()

    if not conn:
        print("Failed to connect to database")
        return

    print(f"Processing {len(image_paths)} images...")
    results = []

    for i, image_path in enumerate(image_paths, 1):
        print(f"[{i}/{len(image_paths)}] Processing: {image_path}")

        file_hash = hashlib.sha256(open(image_path, 'rb').read()).hexdigest()
        result = detector.detect(image_path)

        if result['success']:
            updated = update_file_metadata(conn, image_path, file_hash, result['detections'], result['processing_time_ms'])
            print(f"  -> Detected {len(result['detections'])} objects, DB updated: {updated}")
            results.append({'path': image_path, 'detections': result['detections'], 'updated': updated})
        else:
            print(f"  -> Error: {result.get('error')}")
            results.append({'path': image_path, 'error': result.get('error')})

    conn.close()
    print(f"\nCompleted processing {len(results)} images")

    summary = {'total': len(results), 'with_detections': sum(1 for r in results if r.get('detections')), 'updated': sum(1 for r in results if r.get('updated'))}
    print(f"Summary: {json.dumps(summary)}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python batch-detect-and-update.py <image_path> [<image_path>...]")
        print("Or provide via stdin (one path per line): find . -name '*.jpg' | python batch-detect-and-update.py -")
        sys.exit(1)

    if sys.argv[1] == '-':
        image_paths = [line.strip() for line in sys.stdin if line.strip() and line.strip().endswith('.jpg')]
    else:
        image_paths = sys.argv[1:]

    process_images(image_paths)
