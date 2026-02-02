# OpenCV Detection Service Improvements

## Overview

This document describes the comprehensive improvements made to the SentryVision OpenCV detection service to enhance reliability and accuracy of motion detection, object detection (persons), and face recognition.

## Key Improvements

### 1. Object Detection (YOLOv8)

#### Previous Issues
- Incorrect YOLOv5 output parsing - assumed pixel coordinates when coordinates were normalized
- Low confidence threshold (0.25) caused many false positives
- Only supported YOLOv5, missing out on more accurate YOLOv8

#### Improvements Made
- **YOLOv8 ONNX Support**: Added full support for YOLOv8 Nano model, which provides better accuracy than YOLOv5
- **Correct Output Parsing**: Fixed coordinate system handling for both YOLOv8 and YOLOv5:
  - YOLOv8: Uses normalized coordinates (0-1), converted to pixel coordinates
  - YOLOv5: Uses pixel coordinates relative to input size (640x640), scaled to image size
- **Improved Confidence Threshold**: Increased from 0.25 to 0.4, reducing false positives
- **Better NMS**: Maintained non-maximum suppression at 0.45 to filter overlapping detections
- **Bounds Checking**: Added checks to ensure bounding boxes are within image boundaries

#### Results
- **Higher Accuracy**: YOLOv8 provides better person detection in various lighting conditions
- **Fewer False Positives**: Higher confidence threshold reduces erroneous detections
- **More Reliable**: Correct coordinate parsing ensures accurate bounding boxes

### 2. Motion Detection (Background Subtraction)

#### Previous Issues
- Simple motion detection only compared frame sizes (naive approach)
- No proper computer vision-based motion detection
- Stub implementation that didn't actually detect motion

#### Improvements Made
- **MOG2 Background Subtraction**: Implemented Gaussian Mixture Model-based background subtraction:
  - Adaptive to changing lighting conditions
  - History of 500 frames for stable background model
  - Variance threshold of 16 to detect significant changes
  - Shadow detection enabled (can be disabled)
- **KNN Alternative**: Added K-Nearest Neighbors-based subtraction as faster alternative
- **Per-Camera Models**: Separate background models for each camera to handle different scenes
- **Noise Reduction**: Morphological operations (opening and closing) to reduce false detections:
  - Elliptical kernel (3x3)
  - Two iterations of opening and closing
- **Contour Analysis**: Find and filter motion contours:
  - Minimum area threshold (100 pixels) to filter noise
  - Extract motion regions with coordinates
- **Frame Comparison Mode**: Alternative method to compare two consecutive frames directly
- **Motion Statistics**:
  - Motion percentage of image
  - Number of motion pixels
  - Number of significant contours
  - Confidence score based on motion percentage

#### New Endpoint
```bash
POST /detect-motion
```

**Single Frame (Background Subtraction):**
```bash
curl -X POST http://localhost:8084/detect-motion \
  -F "image=@frame.jpg" \
  -F "cameraId=camera1"
```

**Two Frames (Comparison):**
```bash
curl -X POST http://localhost:8084/detect-motion \
  -F "image1=@frame1.jpg" \
  -F "image2=@frame2.jpg"
```

#### Response Format
```json
{
  "success": true,
  "motion_detected": true,
  "confidence": 75.5,
  "motion_percentage": 7.55,
  "motion_regions": [
    {
      "x": 100,
      "y": 200,
      "width": 150,
      "height": 200,
      "area": 30000
    }
  ],
  "contour_count": 3,
  "motion_pixel_count": 12345
}
```

#### Results
- **Accurate Motion Detection**: Proper computer vision techniques replace naive size comparison
- **Adaptive**: Handles varying lighting and environmental changes
- **Low False Positives**: Morphological filtering removes noise
- **Per-Camera**: Separate models for different scenes

### 3. Face Recognition

#### Previous Issues
- Simple feature extraction using pixel mean (essentially random)
- No proper deep learning embeddings
- Missing DNN face detection models
- Haar cascade only (limited accuracy)
- Recognition was essentially guessing

#### Improvements Made
- **Multi-Method Detection**: Three-tier fallback system:
  1. **face_recognition library** (if available) - Best accuracy with CNN model
  2. **OpenCV DNN Face Detector** - High accuracy using ResNet-based model
  3. **Haar Cascade** - Fast fallback with moderate accuracy
- **Face Recognition Library Integration**: Optional use of dlib-based face_recognition library:
  - CNN-based face detection for high accuracy
  - 128-dimensional face embeddings
  - Robust recognition with tolerance adjustment
- **DNN Face Detection**: Added support for OpenCV's DNN face detector:
  - Model: res10_300x300_ssd_iter_140000_fp16.caffemodel
  - ResNet-10 based architecture
  - Confidence-based filtering (>0.5)
- **Proper Face Embeddings**:
  - When using face_recognition library: 128-dimensional embeddings
  - Fallback: Histogram-based features (better than pixel mean)
- **Improved Training**: Multiple training samples per person:
  - Detects multiple faces per training image
  - Minimum face size check (50x50 pixels)
  - Quality filtering before adding to training set
- **Recognition Confidence**:
  - When using face_recognition: Distance-based confidence
  - Fallback: Euclidean distance with tolerance threshold
- **Per-Face Detection Info**: Returns detection method used for each face

#### New Module
Created `improved_face_recognition.py` with the `ImprovedFaceRecognition` class.

#### API Integration
The improved face recognition integrates seamlessly with existing endpoints:
- `/recognize-faces` - Detect and recognize faces
- `/train-face` - Add training images
- `/retrain-model` - Retrain the recognizer

#### Results
- **Much Better Recognition**: Proper embeddings replace meaningless pixel mean
- **Accurate Detection**: DNN model provides better face detection
- **Flexible**: Works with or without face_recognition library
- **Trainable**: Can learn new faces from uploaded images

### 4. Model Download Script

#### Previous Issues
- Multiple separate download scripts
- Limited model support
- No verification of downloaded models
- No progress indicators

#### Improvements Made
- **Unified Script**: `download_all_models.py` downloads all needed models:
  - YOLOv8n ONNX (primary object detection)
  - YOLOv5n ONNX (backup object detection)
  - DNN Face Detector (res10_300x300_ssd_iter_140000_fp16.caffemodel)
  - DNN Face Detector Config (deploy.prototxt)
- **Progress Tracking**: Real-time download progress with percentage
- **Size Verification**: Validates downloaded files against expected sizes
- **Multiple Mirrors**: Tries multiple URLs for each model
- **Metadata Saving**: Creates `models_metadata.json` with model information
- **Class Names**: Automatically saves COCO class names file
- **Summary Report**: Shows download success/failure summary

#### Usage
```bash
cd opencv-service
python3 download_all_models.py
```

#### Output
```
======================================================================
  SentryVision - Model Downloader
======================================================================
  Models directory: /app/models
✓ Saved 80 COCO class names to /app/models/yolo_classes.txt

======================================================================
  Downloading Models
======================================================================
  [REQUIRED] YOLOv8 Nano ONNX - Fast and accurate
  Downloading from: https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.onnx
  Progress: 100% (6.0 MB)
✓ Downloaded yolov8n.onnx (6.0 MB)
...
```

### 5. Dependencies

#### Updated Requirements
```txt
flask==3.0.0
flask-cors==4.0.0
flask-limiter==3.5.0
redis>=5.0.0
opencv-contrib-python-headless>=4.8.0
numpy>=1.24.0
psycopg2-binary>=2.9.9
face-recognition>=1.3.0  # NEW: Optional but recommended
Pillow>=10.0.0           # NEW: Image processing
```

#### New Dependencies
- `face-recognition>=1.3.0`: Optional high-quality face recognition library
  - Requires dlib (will be installed as dependency)
  - Provides CNN-based face detection and recognition
  - Falls back to OpenCV if not installed

## Usage Guide

### 1. Initial Setup

#### Download Models
```bash
cd opencv-service
python3 download_all_models.py
```

#### Install Dependencies
```bash
pip install -r requirements.txt
```

For best face recognition accuracy (optional):
```bash
# face-recognition requires dlib, which needs CMake
sudo apt-get install cmake
pip install face-recognition
```

### 2. Start Service

#### Development Mode
```bash
cd opencv-service
python3 -m flask --app app run --host 0.0.0.0 --port 8084 --debug
```

#### Docker Mode
```bash
docker-compose up opencv
```

### 3. API Endpoints

#### Motion Detection

**Single Frame (Background Subtraction):**
```bash
curl -X POST http://localhost:8084/detect-motion \
  -F "image=@test_frame.jpg" \
  -F "cameraId=camera1"
```

**Two Frames (Comparison):**
```bash
curl -X POST http://localhost:8084/detect-motion \
  -F "image1=@frame1.jpg" \
  -F "image2=@frame2.jpg"
```

#### Object Detection
```bash
curl -X POST http://localhost:8084/detect-objects \
  -F "image=@test_frame.jpg"
```

#### Face Recognition
```bash
# Detect and recognize faces
curl -X POST http://localhost:8084/recognize-faces \
  -F "image=@test_face.jpg"

# Train new face
curl -X POST http://localhost:8084/train-face \
  -F "image=@person1.jpg" \
  -F "personName=JohnDoe"
```

### 4. Configuration

#### Motion Detection Sensitivity
Adjust in `OptimizedMotionDetector` class:
- `sensitivity`: 0-100 (higher = more sensitive)
- `minConfidence`: 0-100 (minimum confidence to trigger)
- `cooldownPeriod`: ms between detections
- `detectionInterval`: ms between detection runs

#### Object Detection Settings
Adjust in `YOLOObjectDetector.__init__()`:
- `confidence_threshold`: 0.0-1.0 (higher = fewer false positives)
- `nms_threshold`: 0.0-1.0 (lower = stricter overlap filtering)
- `input_size`: Model input size (default 640)

#### Face Recognition Settings
Adjust in `improved_face_recognition.py`:
- `tolerance`: Recognition tolerance (0.0-1.0, lower = stricter)
- Detection method priority: 'dnn' > 'haar'

## Performance Considerations

### Motion Detection
- **MOG2**: ~10-20ms per frame (640x480)
- **KNN**: ~5-10ms per frame (faster, less accurate)
- Background model builds over first few seconds

### Object Detection
- **YOLOv8n ONNX**: ~30-50ms per frame (640x480)
- **YOLOv5n ONNX**: ~25-40ms per frame
- CPU-only performance (can be faster with CUDA)

### Face Detection
- **DNN Model**: ~15-25ms per frame
- **Haar Cascade**: ~5-10ms per frame
- **face_recognition library**: ~50-100ms per frame (most accurate)

### Recommendations
- Use KNN for motion detection if CPU is limited
- Use YOLOv8 for best accuracy, YOLOv5 if faster detection needed
- Install face_recognition library for best face recognition accuracy

## Troubleshooting

### Models Not Downloading
- Check internet connection
- Verify GitHub is accessible
- Try alternative URLs manually from the script

### Face Recognition Not Working
- Ensure models are downloaded: `download_all_models.py`
- Check if face_recognition library is installed (recommended)
- Verify training images contain clear, front-facing faces
- Try adding more training images per person

### Too Many False Positives
- Increase `confidence_threshold` in YOLOObjectDetector (e.g., 0.5)
- Increase `minConfidence` in motion detection settings
- Ensure camera is not pointed at busy areas (trees, fans, etc.)

### Motion Not Detected
- Lower motion detection `sensitivity`
- Check if camera is static (motion detection doesn't work well with PTZ cameras)
- Verify frame rate is sufficient (>5 fps)
- Check lighting conditions (very low light may affect detection)

## Future Improvements

1. **GPU Acceleration**: Add CUDA support for faster inference
2. **Video Processing**: Add batch processing for video files
3. **Tracking**: Implement object tracking across frames
4. **Adaptive Thresholds**: Auto-tune thresholds based on camera scene
5. **Edge Detection**: Add edge-based motion detection as alternative
6. **More Models**: Support YOLOv8 medium/large for higher accuracy
7. **Liveness Detection**: Detect if face is from a photo or real person

## Support

For issues or questions:
1. Check logs: `docker-compose logs opencv`
2. Test health endpoint: `curl http://localhost:8084/health`
3. Verify models: Check `opencv-service/models/` directory
4. Check configuration: Review `opencv-service/app.py` settings
