# Person Detection System Guide

## Overview

The Person Detection System is a comprehensive AI-powered solution that uses TensorFlow.js and the COCO-SSD model to detect persons in real-time camera feeds. This system provides advanced features including detection zones, performance monitoring, and configurable settings.

## Features

### ✅ Core Features
- **Real-time Person Detection**: Continuous monitoring of camera feeds
- **COCO-SSD Model Integration**: Uses pre-trained MobileNet SSD model
- **Configurable Confidence Thresholds**: Adjust sensitivity per camera
- **Cooldown Periods**: Prevent spam events
- **Performance Monitoring**: Track detection times and accuracy
- **Event Image Saving**: Automatic capture of detection events

### ✅ Advanced Features
- **Detection Zones**: Define specific areas for monitoring
- **Bounding Box Support**: Visual indication of detected persons
- **Multi-person Detection**: Detect multiple persons per frame
- **Performance Metrics**: Detailed statistics and monitoring
- **Error Handling**: Robust fallback mechanisms
- **API Integration**: RESTful API for configuration and monitoring

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Camera Feed   │───▶│  Person Detector │───▶│  Event Handler  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  TensorFlow.js   │    │  Socket.IO      │
                       │  COCO-SSD Model  │    │  Notifications  │
                       └──────────────────┘    └─────────────────┘
```

## Configuration

### Camera Settings

Each camera can be configured with the following settings:

```typescript
interface PersonDetectionSettings {
  enabled: boolean;                    // Enable/disable detection
  minConfidence: number;               // Confidence threshold (0-1)
  cooldownPeriod: number;              // Milliseconds between events
  maxDetections: number;               // Max persons per frame
  enableBoundingBoxes: boolean;        // Save images with boxes
  enableZoneDetection: boolean;        // Use detection zones
  detectionZones?: DetectionZone[];    // Specific monitoring areas
}
```

### Detection Zones

Define specific areas within the camera view for monitoring:

```typescript
interface DetectionZone {
  id: string;                          // Unique identifier
  name: string;                        // Human-readable name
  points: { x: number; y: number }[];  // Polygon points (0-1 normalized)
  enabled: boolean;                    // Zone active status
}
```

## API Endpoints

### Camera Management

#### Get Camera Settings
```http
GET /api/person/:cameraId/settings
```

#### Update Camera Settings
```http
PUT /api/person/:cameraId/settings
Content-Type: application/json

{
  "enabled": true,
  "minConfidence": 0.7,
  "cooldownPeriod": 5000,
  "maxDetections": 10,
  "enableBoundingBoxes": true,
  "enableZoneDetection": false
}
```

#### Get Camera Statistics
```http
GET /api/person/:cameraId/stats
```

### Detection Zones

#### Get Detection Zones
```http
GET /api/person/:cameraId/zones
```

#### Add Detection Zone
```http
POST /api/person/:cameraId/zones
Content-Type: application/json

{
  "id": "zone-1",
  "name": "Front Door",
  "points": [
    {"x": 0.2, "y": 0.2},
    {"x": 0.8, "y": 0.2},
    {"x": 0.8, "y": 0.8},
    {"x": 0.2, "y": 0.8}
  ],
  "enabled": true
}
```

#### Remove Detection Zone
```http
DELETE /api/person/:cameraId/zones/:zoneId
```

### System Management

#### Get System Statistics
```http
GET /api/person/system/stats
```

#### Reset Performance Metrics
```http
POST /api/person/system/reset-metrics
Content-Type: application/json

{
  "cameraId": "optional-camera-id"  // Omit to reset all
}
```

#### Test Detection on Image
```http
POST /api/detect-person-from-image?cameraId=camera1
Content-Type: multipart/form-data

image: [image file]
```

## Performance Monitoring

The system tracks detailed performance metrics:

```typescript
interface PerformanceMetrics {
  totalDetections: number;        // Total successful detections
  averageDetectionTime: number;   // Average processing time (ms)
  lastDetectionTime: number;      // Most recent detection time
  errorCount: number;             // Number of errors
  lastError?: string;             // Most recent error message
}
```

## Event System

### Detection Events

When a person is detected, the system emits events via Socket.IO:

```typescript
interface DetectionEvent {
  id: string;                     // Unique event ID
  cameraId: string;               // Source camera
  timestamp: string;              // ISO timestamp
  imagePath: string;              // Saved image path
  confidence: number;             // Highest confidence (%)
  duration: number;               // Event duration
  personDetected: boolean;        // Detection flag
  personCount: number;            // Number of persons
  personBoxes: Array<{            // Bounding box data
    box: number[];                // [x1, y1, x2, y2]
    confidence: number;           // Individual confidence
  }>;
}
```

### Socket.IO Events

- `motionDetected`: Person detection event
- `motionSnapshot`: High-resolution snapshot taken

## Installation & Setup

### Prerequisites

```bash
# Required dependencies (already included)
npm install @tensorflow/tfjs-node
```

### Environment Setup

The system automatically:
1. Loads TensorFlow.js-node module
2. Downloads COCO-SSD model from TensorFlow Hub
3. Initializes detection for all configured cameras
4. Sets up performance monitoring

### Directory Structure

```
server/
├── src/
│   ├── detection/
│   │   └── personDetection.ts     # Main detection logic
│   └── routes/
│       └── index.ts               # API endpoints
├── public/
│   └── events/                    # Saved detection images
└── models/                        # Model cache (auto-created)
```

## Troubleshooting

### Common Issues

#### TensorFlow.js Not Loading
```
Error: TensorFlow.js-node is not available
```
**Solution**: Ensure `@tensorflow/tfjs-node` is properly installed and compatible with your Node.js version.

#### Model Download Fails
```
Error: Failed to load COCO-SSD model
```
**Solution**: Check internet connectivity and firewall settings. The model downloads from TensorFlow Hub.

#### High Memory Usage
**Solution**: 
- Reduce `maxDetections` setting
- Increase `cooldownPeriod`
- Disable `enableBoundingBoxes` if not needed

#### Poor Detection Accuracy
**Solution**:
- Adjust `minConfidence` threshold
- Configure detection zones for specific areas
- Ensure adequate lighting in camera view

### Performance Optimization

1. **CPU Backend**: System uses CPU backend for stability
2. **Memory Management**: Automatic tensor disposal prevents memory leaks
3. **Detection Limiting**: Configurable limits prevent overload
4. **Error Recovery**: Automatic fallback mechanisms

## Testing

### Manual Testing

Use the provided test script:

```bash
cd server
node test-person-detection.js
```

### API Testing

Test individual endpoints using curl or Postman:

```bash
# Get system stats
curl http://localhost:3001/api/person/system/stats

# Get camera settings
curl http://localhost:3001/api/person/camera1/settings

# Update settings
curl -X PUT http://localhost:3001/api/person/camera1/settings \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "minConfidence": 0.7}'
```

## Integration Examples

### Frontend Integration

```typescript
// Get detection stats
const response = await fetch('/api/person/camera1/stats');
const { stats } = await response.json();

// Listen for detection events
socket.on('motionDetected', (event) => {
  if (event.personDetected) {
    console.log(`Person detected: ${event.personCount} persons`);
    console.log(`Confidence: ${event.confidence}%`);
  }
});
```

### Configuration UI

```typescript
// Update camera settings
const updateSettings = async (cameraId: string, settings: PersonDetectionSettings) => {
  const response = await fetch(`/api/person/${cameraId}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  return response.json();
};
```

## Future Enhancements

### Planned Features
- [ ] Bounding box visualization with canvas/sharp
- [ ] Person tracking across frames
- [ ] Face recognition integration
- [ ] Custom model support
- [ ] Advanced zone shapes (circles, irregular polygons)
- [ ] Real-time performance dashboard
- [ ] Alert notifications (email, push)
- [ ] Video recording on detection

### Potential Improvements
- [ ] GPU acceleration support
- [ ] Multiple model backends
- [ ] Distributed processing
- [ ] Advanced analytics
- [ ] Machine learning pipeline integration

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review server logs for error details
3. Test with the provided test script
4. Verify API endpoints with manual testing

## License

This person detection system is part of the Casa Visitor Guardian project.