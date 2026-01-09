#!/usr/bin/env python3
"""
Script to download YOLO model files for the OpenCV service
"""

import os
import requests
from pathlib import Path

def download_file(url, destination):
    """Download a file from URL to destination path"""
    print(f"Downloading {url} to {destination}...")
    
    response = requests.get(url, stream=True)
    response.raise_for_status()
    
    with open(destination, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    print(f"Successfully downloaded {destination}")

def main():
    models_dir = Path("models")
    models_dir.mkdir(exist_ok=True)
    
    # YOLOv3 model files
    yolo_files = [
        {
            "url": "https://pjreddie.com/media/files/yolov3.weights",
            "filename": "yolov3.weights"
        },
        {
            "url": "https://github.com/AlexeyAB/darknet/releases/download/yolo-coco/yolov3.cfg",
            "filename": "yolov3.cfg"
        },
        {
            "url": "https://raw.githubusercontent.com/pjreddie/darknet/master/data/coco.names",
            "filename": "coco.names"
        }
    ]
    
    # YOLOv4-tiny model files (faster alternative)
    yolo_tiny_files = [
        {
            "url": "https://github.com/AlexeyAB/darknet/releases/download/darknet_yolo_v3_optimal/yolov4-tiny.weights",
            "filename": "yolov4-tiny.weights"
        },
        {
            "url": "https://raw.githubusercontent.com/AlexeyAB/darknet/master/cfg/yolov4-tiny.cfg",
            "filename": "yolov4-tiny.cfg"
        }
    ]
    
    all_files = yolo_files + yolo_tiny_files
    
    for file_info in all_files:
        filepath = models_dir / file_info["filename"]
        
        if filepath.exists():
            print(f"{filepath} already exists, skipping...")
            continue
        
        try:
            download_file(file_info["url"], filepath)
        except Exception as e:
            print(f"Failed to download {file_info['filename']}: {e}")
            continue
    
    # Create yolo_classes.txt if it doesn't exist or is empty
    yolo_classes_file = models_dir / "yolo_classes.txt"
    if not yolo_classes_file.exists() or os.path.getsize(yolo_classes_file) == 0:
        coco_names_file = models_dir / "coco.names"
        if coco_names_file.exists():
            print(f"Copying {coco_names_file} to {yolo_classes_file}")
            import shutil
            shutil.copy2(coco_names_file, yolo_classes_file)
        else:
            print(f"Creating default yolo_classes.txt")
            with open(yolo_classes_file, "w") as f:
                classes = [
                    "person", "bicycle", "car", "motorbike", "aeroplane", "bus",
                    "train", "truck", "boat", "traffic light", "fire hydrant",
                    "stop sign", "parking meter", "bench", "bird", "cat", "dog",
                    "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe",
                    "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
                    "skis", "snowboard", "sports ball", "kite", "baseball bat",
                    "baseball glove", "skateboard", "surfboard", "tennis racket",
                    "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl",
                    "banana", "apple", "sandwich", "orange", "broccoli", "carrot",
                    "hot dog", "pizza", "donut", "cake", "chair", "sofa",
                    "pottedplant", "bed", "diningtable", "toilet", "tvmonitor",
                    "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave",
                    "oven", "toaster", "sink", "refrigerator", "book", "clock",
                    "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
                ]
                f.write("\n".join(classes))
    
    print("Model download complete!")

if __name__ == "__main__":
    main()