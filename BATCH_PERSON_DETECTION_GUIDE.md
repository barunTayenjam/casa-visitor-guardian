# Batch Person Detection System Guide

## Overview

The Batch Person Detection System is a dedicated feature that analyzes all saved snapshots for person detection. This system operates independently from the live streaming functionality and is designed to be triggered manually from the frontend interface.

## Key Features

### ✅ **Non-Intrusive Operation**
- **Separate from Live Streaming**: Does not interfere with real-time camera feeds
- **Background Processing**: Runs asynchronously without blocking other operations
- **Manual Trigger**: Initiated by user action, not automatic scheduling

### ✅ **Comprehensive Analysis**
- **Batch Processing**: Analyzes all snapshots in the snapshots directory
- **Configurable Parameters**: Adjustable confidence thresholds and detection limits
- **Detailed Results**: Comprehensive statistics and per-image analysis
- **Progress Monitoring**: Real-time progress updates via Socket.IO

### ✅ **Results Management**
- **JSON Export**: Detailed results saved as downloadable JSON files
- **CSV Summary**: Easy-to-analyze CSV format for spreadsheet applications
- **Historical Tracking**: Maintains history of all batch processing runs
- **File Management**: Automatic organization and cleanup of result files

## Architecture

```
Frontend Button → API Request → Batch Processor → TensorFlow.js → Results Storage
     ↓              ↓              ↓               ↓              ↓
  Settings UI   REST Endpoint   Image Analysis   COCO-SSD      JSON/CSV Files
     ↓              ↓              ↓               ↓              ↓
Socket Updates ← Progress Events ← Processing Loop ← Detection ← File System
```

## API Endpoints

### Start Batch Processing
```http
POST /api/person/batch/process
Content-Type: application/json

{
  "minConfidence": 0.6,
  "maxDetections": 10,
  "includeSubdirectories": false,
  "outputResults": true,
  "saveAnnotatedImages": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Batch person detection started",
  "jobId": "batch_1234567890",
  "options": { ... }
}
```

### Get Processing Status
```http
GET /api/person/batch/status
```

**Response:**
```json
{
  "success": true,
  "status": {
    "isProcessing": true,
    "jobId": "batch_1234567890"
  }
}
```

### Cancel Processing
```http
POST /api/person/batch/cancel
```

**Response:**
```json
{
  "success": true,
  "message": "Batch processing cancelled"
}
```

### Get Results List
```http
GET /api/person/batch/results
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "filename": "batch_detection_2025-01-10T15-30-45-123Z.json",
      "timestamp": "2025-01-10T15:30:45.123Z",
      "size": 15420
    }
  ]
}
```

### Download Specific Result
```http
GET /api/person/batch/results/:filename
```

**Response:**
```json
{
  "success": true,
  "result": {
    "jobId": "batch_1234567890",
    "timestamp": "2025-01-10T15:30:45.123Z",
    "summary": {
      "totalImages": 150,
      "processedImages": 148,
      "personsDetected": 45,
      "imagesWithPersons": 32,
      "errors": 2,
      "processingTime": 45000,
      "successRate": 98.67,
      "detectionRate": 21.62
    },
    "results": [ ... ]
  }
}
```

## Socket.IO Events

### Real-time Progress Updates

The system emits real-time events to keep the frontend updated:

#### `batchDetectionStarted`
```javascript
{
  jobId: "batch_1234567890",
  directory: "/path/to/snapshots",
  options: { minConfidence: 0.6, ... }
}
```

#### `batchDetectionProgress`
```javascript
{
  jobId: "batch_1234567890",
  current: 45,
  total: 150,
  currentFile: "snapshot_cam1_2025-01-10T15-25-30-456Z.jpg",
  percentage: 30
}
```

#### `batchDetectionCompleted`
```javascript
{
  jobId: "batch_1234567890",
  result: {
    totalImages: 150,
    processedImages: 148,
    personsDetected: 45,
    imagesWithPersons: 32,
    errors: 2,
    processingTime: 45000
  }
}
```

#### `batchDetectionError`
```javascript
{
  jobId: "batch_1234567890",
  error: "TensorFlow model failed to load"
}
```

#### `batchDetectionCancelled`
```javascript
{
  message: "Batch processing was cancelled by user"
}
```

## Frontend Integration

### Settings Page Integration

The batch person detection feature is integrated into the Settings page under the "Detection" tab:

```tsx
import BatchPersonDetection from '@/components/dashboard/BatchPersonDetection';

// In the detection tab content:
<TabsContent value="detection" className="space-y-4">
  {/* Existing detection settings */}
  
  {/* Batch Person Detection */}
  <BatchPersonDetection />
</TabsContent>
```

### Component Features

The `BatchPersonDetection` component provides:

- **Start/Cancel Button**: Initiate or stop batch processing
- **Progress Bar**: Visual progress indicator with percentage
- **Real-time Status**: Current file being processed
- **Results Summary**: Statistics from the last run
- **Results History**: List of all previous batch runs
- **Download Links**: Direct download of result files

## Configuration Options

### Processing Parameters

```typescript
interface BatchProcessingOptions {
  minConfidence?: number;        // 0.1-1.0, detection confidence threshold
  maxDetections?: number;        // Maximum persons to detect per image
  includeSubdirectories?: boolean; // Process subdirectories
  outputResults?: boolean;       // Save detailed results
  saveAnnotatedImages?: boolean; // Save images with bounding boxes (future)
}
```

### Default Settings

```javascript
const defaultOptions = {
  minConfidence: 0.6,           // 60% confidence threshold
  maxDetections: 10,            // Up to 10 persons per image
  includeSubdirectories: false, // Only main snapshots directory
  outputResults: true,          // Always save results
  saveAnnotatedImages: false    // Not implemented yet
};
```

## File Structure

### Input Directory
```
server/public/snapshots/
├── snapshot_cam1_2025-01-10T15-25-30-456Z.jpg
├── snapshot_cam2_2025-01-10T15-26-15-789Z.jpg
└── snapshot_cam1_2025-01-10T15-27-45-123Z.jpg
```

### Output Directory
```
server/public/batch-results/
├── batch_detection_2025-01-10T15-30-45-123Z.json
├── batch_detection_summary_2025-01-10T15-30-45-123Z.csv
└── batch_detection_2025-01-09T14-20-15-456Z.json
```

## Result Format

### JSON Result Structure

```json
{
  "jobId": "batch_1234567890",
  "timestamp": "2025-01-10T15:30:45.123Z",
  "summary": {
    "totalImages": 150,
    "processedImages": 148,
    "personsDetected": 45,
    "imagesWithPersons": 32,
    "errors": 2,
    "processingTime": 45000,
    "successRate": 98.67,
    "detectionRate": 21.62
  },
  "results": [
    {
      "imagePath": "/path/to/snapshot_cam1_2025-01-10T15-25-30-456Z.jpg",
      "filename": "snapshot_cam1_2025-01-10T15-25-30-456Z.jpg",
      "cameraId": "cam1",
      "timestamp": "2025-01-10T15:25:30.456Z",
      "personDetected": true,
      "personCount": 2,
      "confidence": 85,
      "processingTime": 245,
      "detectionBoxes": [
        {
          "box": [0.2, 0.3, 0.6, 0.8],
          "confidence": 85
        },
        {
          "box": [0.7, 0.2, 0.9, 0.7],
          "confidence": 78
        }
      ]
    }
  ]
}
```

### CSV Summary Format

```csv
Filename,Camera ID,Timestamp,Person Detected,Person Count,Confidence (%),Processing Time (ms),Error
"snapshot_cam1_2025-01-10T15-25-30-456Z.jpg","cam1","2025-01-10T15:25:30.456Z","Yes",2,85,245,""
"snapshot_cam2_2025-01-10T15-26-15-789Z.jpg","cam2","2025-01-10T15:26:15.789Z","No",0,0,198,""
```

## Performance Considerations

### Processing Speed
- **Average Time**: ~200-300ms per image
- **Batch Size**: Processes images sequentially to prevent memory issues
- **Memory Management**: Automatic tensor disposal prevents memory leaks
- **Throttling**: 100ms delay between images to prevent system overload

### Resource Usage
- **CPU Intensive**: Uses TensorFlow.js CPU backend
- **Memory Efficient**: Processes one image at a time
- **Disk Space**: Results files are typically 1-5MB per batch
- **Network**: Minimal impact on live streaming

## Error Handling

### Common Errors and Solutions

#### TensorFlow Not Available
```
Error: Person detector not available
```
**Solution**: Ensure `@tensorflow/tfjs-node` is properly installed and the person detection system is initialized.

#### No Images Found
```
Warning: Found 0 image files to process
```
**Solution**: Check that the snapshots directory exists and contains image files (jpg, jpeg, png).

#### Processing Already Running
```
Error: Batch processing is already running
```
**Solution**: Wait for current processing to complete or cancel it before starting a new batch.

#### Image Processing Errors
```
Error: Failed to read image file
```
**Solution**: Check file permissions and ensure image files are not corrupted.

## Testing

### Manual Testing

Use the provided test script:

```bash
cd server
node test-batch-detection.js
```

### Frontend Testing

1. Navigate to Settings → Detection tab
2. Click "Start Batch Detection"
3. Monitor progress in real-time
4. Download results when complete
5. Verify CSV and JSON formats

### API Testing

```bash
# Start batch processing
curl -X POST http://localhost:3001/api/person/batch/process \
  -H "Content-Type: application/json" \
  -d '{"minConfidence": 0.6}'

# Check status
curl http://localhost:3001/api/person/batch/status

# Get results
curl http://localhost:3001/api/person/batch/results
```

## Integration with Existing System

### No Impact on Live Streaming
- **Separate Processing**: Uses different code path from real-time detection
- **Independent Resources**: Does not share processing queue with live streams
- **Isolated State**: Maintains separate status and configuration

### Shared Components
- **TensorFlow Model**: Uses the same COCO-SSD model as live detection
- **Person Detector**: Leverages existing `detectPersonsFromImage` method
- **Socket.IO**: Uses existing Socket.IO connection for progress updates

## Future Enhancements

### Planned Features
- [ ] **Bounding Box Visualization**: Save images with drawn detection boxes
- [ ] **Scheduled Processing**: Automatic daily/weekly batch runs
- [ ] **Advanced Filtering**: Date range and camera-specific processing
- [ ] **Comparison Reports**: Compare detection results across time periods
- [ ] **Export Formats**: Additional export formats (PDF, Excel)

### Potential Improvements
- [ ] **Parallel Processing**: Process multiple images simultaneously
- [ ] **Cloud Storage**: Save results to cloud storage services
- [ ] **Email Reports**: Automatic email delivery of results
- [ ] **API Webhooks**: Notify external systems when processing completes

## Troubleshooting

### Common Issues

1. **Button Not Responding**
   - Check browser console for errors
   - Verify Socket.IO connection
   - Ensure server is running

2. **No Progress Updates**
   - Check Socket.IO connection
   - Verify event listeners are properly attached
   - Check server logs for errors

3. **Processing Stuck**
   - Use cancel button to stop processing
   - Check server logs for errors
   - Restart server if necessary

4. **Results Not Downloading**
   - Check browser download settings
   - Verify result files exist on server
   - Check file permissions

### Debug Information

Enable debug logging by checking browser console and server logs:

```javascript
// Browser console
console.log('Socket connected:', socket.connected);

// Server logs
console.log('Batch processing status:', batchDetection.getStatus());
```

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review server logs for error details
3. Test with the provided test script
4. Verify API endpoints manually

This batch person detection system provides a comprehensive solution for analyzing historical snapshots without impacting the live streaming functionality of the security system.