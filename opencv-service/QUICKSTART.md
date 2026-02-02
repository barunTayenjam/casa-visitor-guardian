# Quick Start Guide - Improved OpenCV Detection

## Prerequisites

- Python 3.8+
- pip (Python package manager)
- (Optional) CMake for face_recognition library

## Step 1: Download Models

```bash
cd opencv-service
python3 download_all_models.py
```

This will download:
- YOLOv8n ONNX model (for object/person detection)
- DNN face detection models (for accurate face detection)
- COCO class names file

## Step 2: Install Dependencies

### Basic Installation
```bash
pip install -r requirements.txt
```

### For Best Face Recognition (Optional but Recommended)
```bash
# Install system dependencies for dlib
sudo apt-get install cmake

# Install face_recognition library
pip install face-recognition
```

Note: If face_recognition library is not installed, the system will fall back to OpenCV's DNN detector (still good accuracy).

## Step 3: Start the Service

### Option A: Standalone (Development)
```bash
cd opencv-service
python3 -m flask --app app run --host 0.0.0.0 --port 8084 --debug
```

### Option B: Docker
```bash
# Build and start opencv service
docker-compose up opencv

# Or start all services
docker-compose up
```

## Step 4: Test the Service

### Health Check
```bash
curl http://localhost:8084/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "service": "opencv-detection",
  "model": {
    "type": "YOLO",
    "initialized": true,
    "classCount": 80
  }
}
```

### Test Motion Detection
```bash
# Create a test image (or use an existing one)
wget https://raw.githubusercontent.com/opencv/opencv/master/samples/data/lena.jpg -O test.jpg

# Test with single frame
curl -X POST http://localhost:8084/detect-motion \
  -F "image=@test.jpg" \
  -F "cameraId=test"
```

Expected response:
```json
{
  "success": true,
  "motion_detected": false,
  "confidence": 0.0,
  "motion_percentage": 0.0,
  "motion_regions": [],
  "contour_count": 0
}
```

### Test Object Detection
```bash
curl -X POST http://localhost:8084/detect-objects \
  -F "image=@test.jpg"
```

Expected response (for person image):
```json
{
  "success": true,
  "detections": [
    {
      "class": "person",
      "confidence": 95.0,
      "bbox": {
        "x": 100,
        "y": 50,
        "width": 200,
        "height": 400
      }
    }
  ],
  "fileHash": "..."
}
```

## Step 5: Integrate with Backend

The motion detection is now integrated into the backend. Key changes:

1. **Motion Detection**: Uses `/detect-motion` endpoint with proper background subtraction
2. **Object Detection**: Uses improved YOLOv8 with correct coordinate parsing
3. **Face Recognition**: Uses DNN detector with proper embeddings

### Adjust Sensitivity Settings

Edit `server/src/detection/optimizedMotionDetection.ts`:

```typescript
{
  enabled: true,
  sensitivity: 30,              // 0-100 (higher = more sensitive)
  cooldownPeriod: 30000,        // 30 seconds between detections
  detectionInterval: 2000,       // Check every 2 seconds
  minConfidence: 60,            // Minimum confidence to trigger
  autoDetectObjects: true,       // Run object detection on motion
  autoDetectFaces: true          // Run face detection on motion
}
```

## Common Issues & Solutions

### Issue: "Models not found"
**Solution**: Run `python3 download_all_models.py` in opencv-service directory

### Issue: "Module not found: face_recognition"
**Solution**: Either install it (`pip install face-recognition`) or ignore - the system will fall back to OpenCV's DNN detector

### Issue: Too many false motion detections
**Solutions**:
- Increase `minConfidence` in motion settings (try 70-80)
- Increase `cooldownPeriod` to prevent rapid-fire alerts
- Check camera is stable (not moving due to wind)

### Issue: Not detecting people
**Solutions**:
- Lower `minConfidence` in object detection (in app.py, try 0.3)
- Ensure YOLOv8 model is downloaded
- Check lighting conditions

### Issue: Face recognition not working
**Solutions**:
- Install face_recognition library for best results
- Ensure training images are clear and well-lit
- Add multiple training images per person
- Use the `/train-face` endpoint to add training data

## Performance Tips

### For Faster Processing
1. Use KNN instead of MOG2 for motion detection (faster but less accurate)
2. Lower detection resolution in camera settings
3. Reduce detection interval (check less frequently)

### For Better Accuracy
1. Install face_recognition library
2. Use YOLOv8 (already default)
3. Increase confidence thresholds to reduce false positives
4. Add more training images for face recognition

## Next Steps

1. **Configure Cameras**: Add your RTSP camera URLs in the backend
2. **Adjust Sensitivity**: Tune motion and object detection thresholds
3. **Train Faces**: Add known faces using the web interface or API
4. **Monitor**: Check logs and adjust settings as needed
5. **Scale**: For multiple cameras, consider GPU acceleration

## Support

For detailed information, see:
- `IMPROVEMENTS.md` - Detailed improvement documentation
- `AGENTS.md` - General development guide
- Docker logs: `docker-compose logs opencv -f`

## API Reference

### Motion Detection
- **Endpoint**: `POST /detect-motion`
- **Parameters**: 
  - `image`: Image file (required)
  - `cameraId`: Camera identifier (optional, default "default")
- **Response**: Motion detection results with confidence and regions

### Object Detection
- **Endpoint**: `POST /detect-objects`
- **Parameters**: `image`: Image file (required)
- **Response**: List of detected objects with bounding boxes

### Face Recognition
- **Endpoint**: `POST /recognize-faces`
- **Parameters**: `image`: Image file (required)
- **Response**: List of detected and recognized faces

### Train Face
- **Endpoint**: `POST /train-face`
- **Parameters**: 
  - `image`: Image file (required)
  - `personName`: Person's name (required)
- **Response**: Success message

## Monitoring

### Check Service Status
```bash
curl http://localhost:8084/status
```

### View Models
```bash
ls -lh opencv-service/models/
```

### Check Logs
```bash
# Docker
docker-compose logs opencv -f

# Standalone
# Check console output
```
