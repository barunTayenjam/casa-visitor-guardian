# SentryVision Component Integration Plan
**Date:** January 5, 2026
**Purpose:** Integrate motion detection with automatic object/face detection and unified data storage

---

## Executive Summary

**Critical Issue Identified:**
The motion detection system is **disconnected from object/face detection**. When motion is detected:
- Motion event is saved to `events` table (no detection data)
- Detection data is NOT automatically generated
- Gallery shows "No detection data available. Run batch processing"

**Expected Behavior:**
1. Motion detected → Automatically run object/face detection
2. Detection results saved → events table with metadata
3. Gallery shows unified events with detection data

---

## Current Architecture Analysis

### Data Flow (Current State)

```
┌─────────────────┐
│  RTSP Stream   │
└────────┬────────┘
         │
         ▼
┌────────────────────────────┐
│  Motion Detection Service  │
└────────┬─────────────────┘
         │
         ├─► Socket.IO emits 'motionDetected'
         │
         ▼
    Frontend (shows notification)
         │
         └─► Database: events table (only file_path, no detection data)

┌────────────────────────────┐
│  Batch Processing        │
└────────────────────────────┘
         │
         ▼
    Manual trigger
         │
         ├─► Object/face detection
         │
         └─► Database: batch_result_items table
```

**Problems:**
1. ❌ Motion events DON'T trigger detection automatically
2. ❌ Detection data stored in separate table (batch_result_items)
3. ❌ Gallery reads from wrong table (should be events)
4. ❌ Events table doesn't contain detection metadata
5. ❌ Manual batch processing required

---

## Target Architecture (After Integration)

```
┌─────────────────┐
│  RTSP Stream   │
└────────┬────────┘
         │
         ▼
┌────────────────────────────┐
│  Motion Detection Service  │
└────────┬─────────────────┘
         │
         ├─► Motion detected
         │
         ├─► Save event to events table
         │
         ├─► Trigger object detection
         │
         ├─► Trigger face detection
         │
         └─► Socket.IO emit 'motionDetected'
         │
         ▼
    Frontend (shows notification)
         │
         ▼
         │
┌────────────────────────────┐
│  Object Detection Service │
│  Face Detection Service  │
└────────────────────────────┘
         │
         ▼
    Detect objects/faces
         │
         ▼
    Save detection data to events table
         │
         ▼
    Gallery (reads from events table)
```

---

## Integration Plan

### Phase 1: Events Table Schema Enhancement (1-2 hours)

**Task:** Update events table to include detection metadata

**Implementation:**

```sql
-- database/migrations/006_enhance_events_table.sql

-- Add detection metadata columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS persons_detected INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS faces_detected INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS known_faces_count INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS unknown_faces_count INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS object_detections JSONB DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS face_detections JSONB DEFAULT '[]';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_events_metadata ON events USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_events_detection_data ON events USING GIN (object_detections, face_detections);
```

**Benefits:**
- ✅ Single source of truth for all events
- ✅ Supports both motion events and detection results
- ✅ Gallery can read from one table
- ✅ JSONB fields for flexible detection data

---

### Phase 2: Automatic Detection Trigger (3-4 hours)

**Task:** Modify motion detection to automatically run object/face detection

**Files to Modify:**
1. `server/src/detection/optimizedMotionDetection.ts`
2. `server/src/detection/objectDetectionOpenCV.ts`
3. `server/src/detection/facialRecognitionOpenCV.ts`

**Implementation:**

```typescript
// server/src/detection/optimizedMotionDetection.ts

// Add detection configuration to camera settings
interface OptimizedMotionSettings {
  enabled: boolean;
  sensitivity: number;
  cooldownPeriod: number;
  detectionInterval: number;
  minConfidence: number;
  maxEventsPerHour: number;
  adaptiveMode: boolean;
  nightModeSensitivity: number;
  quietHours: { start: string; end: string };
  
  // NEW: Automatic detection settings
  autoDetectObjects: boolean;      // Automatically run object detection
  autoDetectFaces: boolean;        // Automatically run face detection
  detectionPriority: 'immediate' | 'deferred'; // When to run detection
}

// Modify motion detection to trigger object/face detection
private async handleMotionDetection(cameraId: string, frame: Buffer, motionScore: number): Promise<void> {
  const settings = this.cameraSettings.get(cameraId);
  if (!settings || !settings.enabled) {
    return;
  }

  // 1. Save motion event to database
  const eventFilename = await this.saveMotionEventToDatabase(cameraId, frame, motionScore);

  // 2. Trigger object detection if enabled
  if (settings.autoDetectObjects) {
    const objectsDetected = await this.detectObjectsOnFrame(cameraId, frame);
    
    // Update event with detection data
    await this.updateEventWithDetections(eventFilename, {
      object_detections: objectsDetected.detections || [],
      persons_detected: objectsDetected.persons || 0,
    });
  }

  // 3. Trigger face detection if enabled
  if (settings.autoDetectFaces) {
    const facesDetected = await this.detectFacesOnFrame(cameraId, frame);
    
    // Update event with detection data
    await this.updateEventWithDetections(eventFilename, {
      face_detections: facesDetected.faces || [],
      known_faces_count: facesDetected.knownFaces || 0,
      unknown_faces_count: facesDetected.unknownFaces || 0,
    });
  }

  // 4. Emit Socket.IO event
  const event = await this.getEventFromDatabase(eventFilename);
  this.io.emit('motionDetected', event);
}

private async saveMotionEventToDatabase(cameraId: string, frame: Buffer, motionScore: number): Promise<string> {
  const filename = `motion_${cameraId}_${Date.now()}.jpg`;
  const filePath = getEventPath(filename);
  
  // Save image
  fs.writeFileSync(filePath, frame);
  
  // Create database record
  const event = new Event();
  event.id = generateUUID();
  event.event_type = 'motion';
  event.file_path = filePath;
  event.camera_id = cameraId;
  event.timestamp = new Date();
  event.confidence = motionScore;
  event.metadata = {
    motionScore,
    motionArea: this.calculateMotionArea(frame),
    lightLevel: this.calculateLightLevel(frame),
  };
  
  await AppDataSource.getRepository(Event).save(event);
  
  return filename;
}

private async updateEventWithDetections(filename: string, detectionData: any): Promise<void> {
  await AppDataSource.createQueryBuilder()
    .update(Event)
    .set({
      object_detections: detectionData.object_detections || null,
      face_detections: detectionData.face_detections || null,
      persons_detected: detectionData.persons_detected || null,
      known_faces_count: detectionData.known_faces_count || null,
      unknown_faces_count: detectionData.unknown_faces_count || null,
    })
    .where('filename = :filename', { filename })
    .execute();
}
```

**Benefits:**
- ✅ Automatic detection on motion events
- ✅ Unified storage in events table
- ✅ Gallery shows complete data
- ✅ No manual batch processing needed

---

### Phase 3: Enhanced Event Model (1-2 hours)

**Task:** Update Event model to include detection data

**Implementation:**

```typescript
// server/src/models/Event.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index
} from 'typeorm';
import { Camera } from './Camera.js';

@Entity('events')
@Index(['camera_id', 'timestamp'])
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'character varying', length: 50 })
  event_type: 'motion' | 'face' | 'object' | 'batch' | 'system';

  @Column({ type: 'character varying', length: 255 })
  file_path: string;

  @Column({ type: 'character varying', length: 255, nullable: true })
  thumbnail_path: string;

  @Column({ type: 'timestamp without time zone', default: () => () => new Date() })
  timestamp: Date;

  @Column({ type: 'character varying', length: 100 })
  camera_id: string;

  @Column({ type: 'text', nullable: true })
  metadata: string;

  @Column({ type: 'float', nullable: true })
  confidence: number;

  // NEW: Detection metadata columns
  @Column({ type: 'integer', default: 0 })
  persons_detected: number;

  @Column({ type: 'integer', default: 0 })
  faces_detected: number;

  @Column({ type: 'integer', default: 0 })
  known_faces_count: number;

  @Column({ type: 'integer', default: 0 })
  unknown_faces_count: number;

  @Column({ type: 'jsonb', nullable: true })
  object_detections: any;

  @Column({ type: 'jsonb', nullable: true, default: '[]' })
  face_detections: any;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
```

---

### Phase 4: Gallery Component Updates (2-3 hours)

**Task:** Update Gallery to read from events table and show detection data

**Implementation:**

```typescript
// src/components/dashboard/MediaGallery.tsx

// Add detection data fetching
const loadMedia = async () => {
  try {
    setLoading(true);

    // Load events from events table (unified)
    const eventsResponse = await apiService.getEventsList({
      limit: 100,
      sortBy: 'newest'
    });

    setEvents(eventsResponse.events || []);

    // Filter events by type
    const motionEvents = eventsResponse.events.filter(e => e.event_type === 'motion');
    const objectEvents = eventsResponse.events.filter(e => e.event_type === 'object');

    setMotionEvents(motionEvents);
    setObjectEvents(objectEvents);

    // Show combined count
    console.log(`Loaded ${eventsResponse.events.length} events: ${motionEvents.length} motion, ${objectEvents.length} object`);
  } catch (error) {
    console.error('Failed to load media:', error);
    setEvents([]);
    setSnapshots([]);
  } finally {
    setLoading(false);
  }
};

// Update render to show detection data
const renderEventDetails = (event: any) => {
  const hasDetections = event.object_detections && event.object_detections.length > 0;
  const hasFaces = event.face_detections && event.face_detections.length > 0;

  return (
    <div>
      <div>Filename: {event.file_path.split('/').pop()}</div>
      <div>Camera: {event.camera_id}</div>
      <div>Time: {format(event.timestamp, 'PPPpp')}</div>

      <div>
        <div className="font-medium mb-2">Detections</div>
        {hasDetections ? (
          <div className="space-y-2">
            {event.object_detections.map((detection: any, index: number) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <Badge className="bg-green-500 text-white">
                  {detection.class}
                </Badge>
                <span>{Math.round(detection.confidence)}% confidence</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground">
            No detection data available
          </div>
        )}
      </div>

      <div>
        <div className="font-medium mb-2">Faces</div>
        {hasFaces ? (
          <div className="space-y-2">
            {event.face_detections.map((face: any, index: number) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <Badge className={face.isKnown ? "bg-blue-500 text-white" : "bg-yellow-500 text-white"}>
                  {face.isKnown ? "Known" : "Unknown"}
                </Badge>
                <span>{Math.round(face.confidence)}% confidence</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground">
            No face detection data available
          </div>
        )}
      </div>
    </div>
  );
};
```

**Benefits:**
- ✅ Gallery shows complete detection data
- ✅ No "No detection data available" message for detected events
- ✅ Unified view of motion + detection data
- ✅ Separate tabs for motion events and object events

---

### Phase 5: API Endpoints Updates (2-3 hours)

**Task:** Update API to support detection data

**Implementation:**

```typescript
// server/src/routes/index.ts

// Update getEventsList to include detection data
app.get('/api/events/list', async (req: Request, res: Response) => {
  try {
    const { limit = 100, event_type, camera_id, start_date, end_date } = req.query;

    let query = AppDataSource.getRepository(Event)
      .createQueryBuilder('event')
      .select('event')
      .where('event.event_type IN (:...eventTypes)', {
        eventTypes: event_type ? [event_type] : ['motion', 'face', 'object', 'batch']
      })
      .orderBy('event.timestamp', 'DESC')
      .limit(limit);

    if (camera_id) {
      query.andWhere('event.camera_id = :camera_id', { camera_id });
    }

    if (start_date && end_date) {
      query.andWhere('event.timestamp BETWEEN :startDate AND :endDate', {
        startDate: start_date,
        endDate: end_date
      });
    }

    const events = await query.getMany();

    res.json({
      success: true,
      events: events.map(event => ({
        id: event.id,
        event_type: event.event_type,
        filename: event.file_path.split('/').pop(),
        timestamp: event.timestamp,
        cameraId: event.camera_id,
        confidence: event.confidence || 0,
        metadata: event.metadata ? JSON.parse(event.metadata) : null,
        
        // NEW: Detection data
        persons_detected: event.persons_detected || 0,
        faces_detected: event.faces_detected || 0,
        known_faces_count: event.known_faces_count || 0,
        unknown_faces_count: event.unknown_faces_count || 0,
        object_detections: event.object_detections || null,
        face_detections: event.face_detections || null,
      }))
    });
  } catch (error) {
    console.error('Failed to fetch events:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch events' });
  }
});

// Update event image endpoint to support detection data display
app.get('/api/events/:id/details', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const event = await AppDataSource.getRepository(Event)
      .findOne({ where: { id } });

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // Enrich with detection data
    const result = {
      success: true,
      event: {
        id: event.id,
        event_type: event.event_type,
        filename: event.file_path.split('/').pop(),
        timestamp: event.timestamp,
        cameraId: event.camera_id,
        confidence: event.confidence || 0,
        metadata: event.metadata ? JSON.parse(event.metadata) : null,
        
        // Detection details
        persons_detected: event.persons_detected || 0,
        faces_detected: event.faces_detected || 0,
        known_faces_count: event.known_faces_count || 0,
        unknown_faces_count: event.unknown_faces_count || 0,
        object_detections: event.object_detections,
        face_detections: event.face_detections,
      }
    };

    res.json(result);
  } catch (error) {
    console.error('Failed to fetch event details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch event details' });
  }
});
```

**Benefits:**
- ✅ Single API endpoint for all events
- ✅ Detection data included in responses
- ✅ Gallery can show complete information
- ✅ Unified data model

---

### Phase 6: Frontend API Service Updates (1-2 hours)

**Task:** Update ApiService to handle detection data

**Implementation:**

```typescript
// src/services/ApiService.ts

export interface DetectionData {
  class: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface FaceDetectionData {
  id: string;
  name: string;
  isKnown: boolean;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface EnhancedEvent {
  id: string;
  event_type: string;
  filename: string;
  timestamp: string;
  cameraId: string;
  confidence: number;
  metadata: any;
  
  // NEW: Detection data
  persons_detected: number;
  faces_detected: number;
  known_faces_count: number;
  unknown_faces_count: number;
  object_detections: DetectionData[] | null;
  face_detections: FaceDetectionData[] | null;
}

// Update getEventsList to return EnhancedEvent
async getEventsList(options?: {
  limit?: number;
  event_type?: string;
  camera_id?: string;
  start_date?: string;
  end_date?: string;
}): Promise<{ success: boolean; events: EnhancedEvent[]; pagination?: any }> {
  const params = new URLSearchParams(options as any);
  const response = await this.fetchWithRetry(`/api/events/list?${params}`);
  return response.json();
}

// Add method to get event details with detection data
async getEventDetails(eventId: string): Promise<{ success: boolean; event: EnhancedEvent }> {
  const response = await this.fetchWithRetry(`/api/events/${eventId}/details`);
  return response.json();
}
```

---

### Phase 7: Camera Settings UI (2-3 hours)

**Task:** Add UI to configure automatic detection

**Implementation:**

```typescript
// src/pages/Settings.tsx

// Add to camera settings section
const CameraDetectionSettings = () => {
  const [autoDetectObjects, setAutoDetectObjects] = useState(true);
  const [autoDetectFaces, setAutoDetectFaces] = useState(true);
  const [detectionPriority, setDetectionPriority] = useState<'immediate' | 'deferred'>('immediate');

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Automatic Detection Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoDetectObjects}
              onChange={(e) => setAutoDetectObjects(e.target.checked)}
            />
            <span>Automatically detect objects on motion</span>
          </label>
          <Switch checked={autoDetectObjects} onCheckedChange={setAutoDetectObjects} />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoDetectFaces}
              onChange={(e) => setAutoDetectFaces(e.target.checked)}
            />
            <span>Automatically detect faces on motion</span>
          </label>
          <Switch checked={autoDetectFaces} onCheckedChange={setAutoDetectFaces} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Detection Priority</label>
          <Select value={detectionPriority} onValueChange={setDetectionPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="immediate">Immediate (detect during motion)</SelectItem>
              <SelectItem value="deferred">Deferred (process in background)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
```

**Benefits:**
- ✅ User control over automatic detection
- ✅ Performance tuning options
- ✅ Clear visibility of system behavior

---

## Implementation Timeline

### Day 1: Database Schema Enhancement
- [ ] Create migration file `006_enhance_events_table.sql`
- [ ] Update Event model with new columns
- [ ] Run migration and verify
- [ ] Update TypeORM entities

### Day 2: Automatic Detection Trigger
- [ ] Modify OptimizedMotionDetector to call detection services
- [ ] Add detection methods (detectObjectsOnFrame, detectFacesOnFrame)
- [ ] Implement database save/update logic
- [ ] Test motion → detection integration

### Day 3: API Updates
- [ ] Update Event routes to include detection data
- [ ] Add event details endpoint
- [ ] Update ApiService interface
- [ ] Test API endpoints

### Day 4: Frontend Updates
- [ ] Update MediaGallery component
- [ ] Update EventViewer component
- [ ] Add event details dialog
- [ ] Update ApiService methods
- [ ] Test frontend with new data

### Day 5: Settings UI
- [ ] Add automatic detection settings to Settings page
- [ ] Add camera-specific configuration
- [ ] Connect to backend API
- [ ] Test settings save/load

### Day 6: Integration Testing
- [ ] Test full flow: motion → detection → display
- [ ] Test Gallery with new data structure
- [ ] Test event details view
- [ ] Test settings changes
- [ ] Performance testing with multiple cameras

---

## Data Flow After Integration

```
Motion Detected (RTSP Frame)
    │
    ├─► Save to events table (initial)
    │
    ├─► Trigger object detection (if enabled)
    │       │
    │       ├─► Call OpenCV /detect-objects
    │       │
    │       └─► Update events table with detection data
    │
    ├─► Trigger face detection (if enabled)
    │       │
    │       ├─► Call OpenCV /recognize-faces
    │       │
    │       └─► Update events table with detection data
    │
    └─► Socket.IO emit 'motionDetected'
            │
            ▼
        Frontend receives event
            │
            ├─► Gallery updates with detection data
            │
            └─► User sees complete event information
```

---

## Success Criteria

### Phase 1: Database
- ✅ Migration creates new columns
- ✅ Event model updated
- ✅ Data can be stored and retrieved
- ✅ Indexes created for performance

### Phase 2: Detection Integration
- ✅ Motion detection calls detection services
- ✅ Detection results saved to events table
- ✅ Retry and circuit breaker work
- ✅ Performance acceptable (< 2 seconds for motion + detection)

### Phase 3: API
- ✅ Events API returns detection data
- ✅ Event details endpoint working
- ✅ Filtering by type/camera works
- ✅ Pagination works correctly

### Phase 4: Frontend
- ✅ Gallery shows detection data
- ✅ "No detection data available" message removed
- ✅ Event details dialog shows all information
- ✅ Real-time updates via Socket.IO

### Phase 5: Settings
- ✅ Users can configure automatic detection
- ✅ Settings persist across restarts
- ✅ Changes take effect immediately
- ✅ Clear UI feedback

### Overall Integration
- ✅ Motion events automatically trigger detection
- ✅ Detection data unified in events table
- ✅ Gallery shows complete event information
- ✅ No manual batch processing needed
- ✅ System is fully automated
- ✅ All architecture improvements still functional

---

## Testing Checklist

### Unit Tests
- [ ] Event model with detection data
- [ ] Database save/update operations
- [ ] Detection service integration
- [ ] API endpoint responses

### Integration Tests
- [ ] Motion → Object detection flow
- [ ] Motion → Face detection flow
- [ ] Database persistence
- [ ] Socket.IO event delivery
- [ ] Gallery display with detection data

### End-to-End Tests
- [ ] Simulate motion on camera
- [ ] Verify automatic detection runs
- [ ] Verify event saved to database
- [ ] Verify detection data included
- [ ] Verify Gallery shows complete info
- [ ] Test with multiple cameras simultaneously
- [ ] Test detection priority settings

---

## Rollback Plan

If integration causes issues:

1. **Disable automatic detection in camera settings**
   - Detection still works manually
   - Motion events still saved

2. **Revert to separate batch processing**
   - Keep batch_result_items table
   - Restore Gallery to read from batch table

3. **Rollback database migration**
   - Add columns can be dropped
   - Events table structure restored

4. **Feature flags**
   - `ENABLE_AUTO_DETECTION=true/false` environment variable
   - Disable automatic detection if problems occur

---

## Known Limitations

1. **Performance Impact**
   - Automatic detection on every motion event
   - CPU intensive during high activity periods
   - Mitigation: Rate limiting and detection priority settings

2. **Database Size**
   - JSONB columns for detection data
   - Faster than separate table joins
   - Mitigation: Automated cleanup (already implemented)

3. **Real-time Latency**
   - Full detection may take 1-2 seconds
   - Frontend shows motion notification immediately
   - Detection data updates asynchronously

---

## Next Steps

### Immediate (Before Implementation)
1. Review and approve this plan
2. Backup current database
3. Create feature branch: `feature/integrated-detection`
4. Enable feature flags for gradual rollout

### During Implementation
1. Implement phases in order
2. Test each phase independently
3. Update integration test report
4. Monitor system performance

### After Implementation
1. Run full integration test suite
2. Update documentation
3. Deploy to staging
4. Monitor metrics for 24-48 hours
5. Gather user feedback
6. Production deployment

---

## Dependencies

### Required (Already Implemented)
- ✅ Object detection service with retry logic
- ✅ Face recognition service
- ✅ Circuit breaker pattern
- ✅ Redis caching
- ✅ Event queue service
- ✅ Database cleanup service
- ✅ Health check endpoints

### New (To Implement)
- ⏳ Database schema enhancements
- ⏳ Automatic detection trigger
- ⏳ Enhanced event model
- ⏳ API endpoint updates
- ⏳ Frontend component updates
- ⏳ Settings UI

---

## Success Metrics

### After Integration, expect to see:

**Performance:**
- Motion + Detection: < 3 seconds end-to-end
- Database query latency: < 10ms
- Gallery load time: < 1 second
- System CPU usage: < 70% during normal operation

**User Experience:**
- Motion events always show detection data
- No "No detection data available" messages
- Automatic detection works seamlessly
- Settings provide clear control
- Real-time notifications work reliably

**Data Quality:**
- All motion events have detection data
- Detection results properly stored
- No lost or orphaned records
- Audit trail complete

**System Reliability:**
- Automatic recovery from failures (retry)
- Circuit breaker prevents overload
- Events persist across restarts
- Health monitoring in place
- Automatic cleanup running

---

**Report Version:** 1.0
**Last Updated:** January 5, 2026
**Status:** Ready for Implementation
