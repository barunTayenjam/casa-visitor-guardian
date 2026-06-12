#!/usr/bin/env python3
"""
Download YOLOv8 model for object detection
Uses ONNX format for better compatibility with OpenCV DNN
"""

import os
import urllib.request

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
YOLOv8_URLS = [
    "https://github.com/ultralytics/assets/releases/download/v8.4.0/yolov8n.onnx",
    "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.onnx",
    "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.onnx",
]
YOLOv8_PATH = os.path.join(MODELS_DIR, 'yolov8n.onnx')

# COCO class names (80 classes)
COCO_CLASSES = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
    "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
    "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
    "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
    "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
    "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
    "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake",
    "chair", "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop",
    "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
    "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier",
    "toothbrush"
]

def download_model():
    """Download YOLOv8 ONNX model"""
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    if os.path.exists(YOLOv8_PATH):
        print(f"YOLOv8 model already exists at {YOLOv8_PATH}")
        size_mb = os.path.getsize(YOLOv8_PATH) / (1024 * 1024)
        print(f"Model size: {size_mb:.2f} MB")
        return True
    
    for url in YOLOv8_URLS:
        print(f"Trying: {url}")
        try:
            urllib.request.urlretrieve(url, YOLOv8_PATH)
            size_mb = os.path.getsize(YOLOv8_PATH) / (1024 * 1024)
            print(f"✓ YOLOv8 model downloaded to {YOLOv8_PATH} ({size_mb:.2f} MB)")
            return True
        except Exception as e:
            print(f"  Failed: {e}")
            continue
    
    print("✗ Failed to download YOLOv8 model from all sources")
    return False

def save_class_names():
    """Save COCO class names to file"""
    class_names_path = os.path.join(MODELS_DIR, 'yolo_classes.txt')
    
    if os.path.exists(class_names_path):
        print(f"Class names file already exists at {class_names_path}")
        return
    
    with open(class_names_path, 'w') as f:
        for name in COCO_CLASSES:
            f.write(name + '\n')
    print(f"✓ Class names saved to {class_names_path}")

if __name__ == "__main__":
    print("=" * 50)
    print("Downloading YOLOv8 Object Detection Model")
    print("=" * 50)
    
    save_class_names()
    success = download_model()
    
    print("=" * 50)
    if success:
        print("Model download complete!")
    else:
        print("Model download failed - will use fallback detection")
    print("=" * 50)
