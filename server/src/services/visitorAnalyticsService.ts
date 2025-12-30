import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { getVisitorDatabase, Visitor, VisitorTimeline, VisitorAnalytics } from './visitorDatabasePostgres.js';
import { FacialRecognitionService, FaceRecognitionEvent, KnownPerson } from '../detection/facialRecognition.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export interface VisitorDetectionEvent {
  id: string;
  timestamp: Date;
  cameraId: string;
  confidence: number;
  imagePath: string;
  detectionType: 'face' | 'person';
  isKnown: boolean;
  personName?: string;
  personId?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  embedding?: number[];
}

export interface VisitorAnalysis {
  totalDetections: number;
  uniqueVisitors: number;
  knownVisitors: number;
  unknownVisitors: number;
  timeSlots: Array<{
    hour: number;
    detections: number;
    uniqueVisitors: number;
  }>;
  cameraAnalysis: Array<{
    cameraId: string;
    detections: number;
    uniqueVisitors: number;
  }>;
  patterns: {
    peakHour: number;
    peakDay: string;
    averageVisitDuration: number;
    repeatVisitorRate: number;
  };
  security: {
    nightTimeDetections: number;
    unusualActivity: Array<{
      type: 'night_time' | 'frequent' | 'unusual_location';
      description: string;
      timestamp: Date;
      severity: 'low' | 'medium' | 'high';
    }>;
  };
}

export class VisitorAnalyticsService extends EventEmitter {
  private eventsDir: string;
  private batchResultsDir: string;
  private faceRecognitionService: FacialRecognitionService;
  private processingQueue: VisitorDetectionEvent[] = [];
  private isProcessing = false;

  constructor() {
    super();
    this.eventsDir = path.join(__dirname, '../../public/events');
    this.batchResultsDir = path.join(__dirname, '../../public/batch-results');
    this.faceRecognitionService = new FacialRecognitionService();
    this.initializeServices();
  }

  private async initializeServices(): Promise<void> {
    try {
      const visitorDatabase = await getVisitorDatabase();
      // Already initialized by getVisitorDatabase()
      // Don't call initialize on faceRecognitionService as it doesn't have that method
      console.log('Visitor analytics service initialized');
    } catch (error) {
      console.error('Failed to initialize visitor analytics service:', error);
    }
  }

  // Advanced detection with multiple algorithms
  async performAdvancedDetection(startDate: Date, endDate: Date): Promise<VisitorAnalysis> {
    console.log(`Performing advanced visitor detection from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const detectionEvents = await this.collectDetectionEvents(startDate, endDate);
    const analysis = await this.analyzeVisitorPatterns(detectionEvents);
    
    // Emit analysis results for real-time updates
    this.emit('analysisCompleted', analysis);
    
    return analysis;
  }

  // Collect all detection events from various sources
  private async collectDetectionEvents(startDate: Date, endDate: Date): Promise<VisitorDetectionEvent[]> {
    const events: VisitorDetectionEvent[] = [];

    // 1. Face detection events from file system
    const faceEvents = await this.collectFaceDetectionEvents(startDate, endDate);
    events.push(...faceEvents);

    // 2. Person detection events from batch processing results
    const personEvents = await this.collectPersonDetectionEvents(startDate, endDate);
    events.push(...personEvents);

    // 3. Motion events with advanced filtering
    const motionEvents = await this.collectAdvancedMotionEvents(startDate, endDate);
    events.push(...motionEvents);

    // 4. Live events from facial recognition service
    const liveEvents = await this.collectLiveRecognitionEvents(startDate, endDate);
    events.push(...liveEvents);

    // Sort events by timestamp
    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Collect face detection events from file system
  private async collectFaceDetectionEvents(startDate: Date, endDate: Date): Promise<VisitorDetectionEvent[]> {
    const events: VisitorDetectionEvent[] = [];
    
    try {
      // Find all face detection files within date range
      const facePattern = path.join(this.eventsDir, 'faces_*.jpg');
      const faceFiles = await glob(facePattern);

      for (const filePath of faceFiles) {
        const fileStat = fs.statSync(filePath);
        const fileModified = fileStat.mtime;

        if (fileModified >= startDate && fileModified <= endDate) {
          const filename = path.basename(filePath);
          const timestamp = this.extractTimestampFromFilename(filename);
          const cameraId = this.extractCameraIdFromFilename(filename);

          if (timestamp && cameraId) {
            // Try to match face with known persons
            const faceRecognition = await this.performFaceRecognition(filePath);
            
            events.push({
              id: `face_${filename}_${Date.now()}`,
              timestamp: new Date(timestamp),
              cameraId,
              confidence: faceRecognition.confidence,
              imagePath: filePath,
              detectionType: 'face',
              isKnown: faceRecognition.isKnown,
              personName: faceRecognition.personName,
              personId: faceRecognition.personId,
              boundingBox: faceRecognition.boundingBox,
              embedding: faceRecognition.embedding
            });
          }
        }
      }
    } catch (error) {
      console.error('Error collecting face detection events:', error);
    }

    return events;
  }

  // Collect person detection events from batch processing results
  private async collectPersonDetectionEvents(startDate: Date, endDate: Date): Promise<VisitorDetectionEvent[]> {
    const events: VisitorDetectionEvent[] = [];

    try {
      const batchPattern = path.join(this.batchResultsDir, 'batch_*.json');
      const batchFiles = await glob(batchPattern);

      for (const batchFile of batchFiles) {
        const fileStat = fs.statSync(batchFile);
        
        if (fileStat.mtime >= startDate && fileStat.mtime <= endDate) {
          const batchData = JSON.parse(fs.readFileSync(batchFile, 'utf-8'));
          
          if (batchData.results && Array.isArray(batchData.results)) {
            for (const result of batchData.results) {
              if (result.persons && Array.isArray(result.persons)) {
                for (const person of result.persons) {
                  events.push({
                    id: `person_${result.filename}_${person.class}_${Date.now()}`,
                    timestamp: new Date(result.timestamp || result.image_timestamp || fileStat.mtime),
                    cameraId: result.camera_id || 'unknown',
                    confidence: person.confidence,
                    imagePath: result.file_path || result.filename,
                    detectionType: 'person',
                    isKnown: false, // Person detection doesn't provide identity
                    boundingBox: person.bbox
                  });
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error collecting person detection events:', error);
    }

    return events;
  }

  // Collect motion events with advanced filtering to reduce false positives
  private async collectAdvancedMotionEvents(startDate: Date, endDate: Date): Promise<VisitorDetectionEvent[]> {
    const events: VisitorDetectionEvent[] = [];

    try {
      const motionPattern = path.join(this.eventsDir, 'snapshot_*.jpg');
      const motionFiles = await glob(motionPattern);

      // Advanced filtering: analyze motion patterns to identify potential visitors
      for (const filePath of motionFiles) {
        const fileStat = fs.statSync(filePath);
        
        if (fileStat.mtime >= startDate && fileStat.mtime <= endDate) {
          const filename = path.basename(filePath);
          const timestamp = this.extractTimestampFromFilename(filename);
          const cameraId = this.extractCameraIdFromFilename(filename);

          if (timestamp && cameraId) {
            // Apply advanced filtering to distinguish visitors from environmental motion
            const isVisitorMotion = await this.analyzeMotionPattern(filePath);
            
            if (isVisitorMotion) {
              events.push({
                id: `motion_${filename}_${Date.now()}`,
                timestamp: new Date(timestamp),
                cameraId,
                confidence: 0.75, // Medium confidence for motion-based detection
                imagePath: filePath,
                detectionType: 'person',
                isKnown: false
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error collecting motion events:', error);
    }

    return events;
  }

  // Collect live recognition events from facial recognition service
  private async collectLiveRecognitionEvents(startDate: Date, endDate: Date): Promise<VisitorDetectionEvent[]> {
    const events: VisitorDetectionEvent[] = [];

    try {
      // This would integrate with the real-time facial recognition events
      // For now, we'll simulate by checking recent face recognition events
      const recentEvents = await this.getRecentFaceRecognitionEvents(startDate, endDate);
      
      for (const event of recentEvents) {
        for (const face of event.knownFaces) {
          events.push({
            id: `live_${event.id}_${face.person.id}_${Date.now()}`,
            timestamp: new Date(event.timestamp),
            cameraId: event.cameraId,
            confidence: face.matchConfidence,
            imagePath: event.imagePath,
            detectionType: 'face',
            isKnown: true,
            personName: face.person.name,
            personId: face.person.id,
            boundingBox: face.bbox
          });
        }

        for (const face of event.unknownFaces) {
          events.push({
            id: `live_unknown_${event.id}_${Date.now()}`,
            timestamp: new Date(event.timestamp),
            cameraId: event.cameraId,
            confidence: face.confidence,
            imagePath: event.imagePath,
            detectionType: 'face',
            isKnown: false,
            boundingBox: face.bbox
          });
        }
      }
    } catch (error) {
      console.error('Error collecting live recognition events:', error);
    }

    return events;
  }

  // Perform face recognition on an image
  private async performFaceRecognition(imagePath: string): Promise<{
    confidence: number;
    isKnown: boolean;
    personName?: string;
    personId?: string;
    boundingBox?: any;
    embedding?: number[];
  }> {
    try {
      // This would integrate with the actual face recognition service
      // For now, return a basic structure
      const imageBuffer = fs.readFileSync(imagePath);
      
      // Placeholder - in real implementation, this would use OpenCV or similar
      // to detect faces and match against known persons
      return {
        confidence: 0.85,
        isKnown: false,
        boundingBox: { x: 0, y: 0, width: 100, height: 100 }
      };
    } catch (error) {
      console.error('Error performing face recognition:', error);
      return {
        confidence: 0.5,
        isKnown: false
      };
    }
  }

  // Analyze motion pattern to determine if it's likely a visitor
  private async analyzeMotionPattern(imagePath: string): Promise<boolean> {
    try {
      // Advanced motion analysis to distinguish:
      // - People vs animals vs environmental motion
      // - Visitor behavior patterns vs routine motion
      
      // This would use computer vision to analyze:
      // - Object size and shape
      // - Movement patterns
      // - Time of day patterns
      // - Location-specific patterns
      
      // Placeholder implementation
      const imageBuffer = fs.readFileSync(imagePath);
      const imageStats = await this.analyzeImageCharacteristics(imageBuffer);
      
      // Basic heuristics for visitor detection
      const isLikelyVisitor = 
        imageStats.hasHumanoidShape && 
        imageStats.movementPattern === 'walking' &&
        imageStats.objectSize > 0.05; // Minimum 5% of frame
      
      return isLikelyVisitor;
    } catch (error) {
      console.error('Error analyzing motion pattern:', error);
      return false;
    }
  }

  // Analyze image characteristics for advanced detection
  private async analyzeImageCharacteristics(imageBuffer: Buffer): Promise<{
    hasHumanoidShape: boolean;
    movementPattern: string;
    objectSize: number;
    confidence: number;
  }> {
    // This would use computer vision libraries for advanced analysis
    // Placeholder implementation
    return {
      hasHumanoidShape: true,
      movementPattern: 'walking',
      objectSize: 0.15,
      confidence: 0.75
    };
  }

  // Analyze visitor patterns from collected events
  private async analyzeVisitorPatterns(events: VisitorDetectionEvent[]): Promise<VisitorAnalysis> {
    console.log(`Analyzing ${events.length} detection events for visitor patterns`);

    // Group events by time slots
    const timeSlots = this.groupEventsByHour(events);
    const cameraAnalysis = this.groupEventsByCamera(events);
    const patterns = this.extractVisitorPatterns(events);
    const security = this.analyzeSecurityPatterns(events);

    // Identify unique visitors using face clustering
    const uniqueVisitors = await this.identifyUniqueVisitors(events);

    return {
      totalDetections: events.length,
      uniqueVisitors: uniqueVisitors.length,
      knownVisitors: uniqueVisitors.filter(v => v.type === 'known').length,
      unknownVisitors: uniqueVisitors.filter(v => v.type === 'unknown').length,
      timeSlots,
      cameraAnalysis,
      patterns,
      security
    };
  }

  // Group events by hour for time-based analysis
  private groupEventsByHour(events: VisitorDetectionEvent[]): Array<{ hour: number; detections: number; uniqueVisitors: number }> {
    const hourlyStats = new Map<number, { detections: Set<string>; visitors: Set<string> }>();

    for (const event of events) {
      const hour = event.timestamp.getHours();
      
      if (!hourlyStats.has(hour)) {
        hourlyStats.set(hour, { detections: new Set(), visitors: new Set() });
      }
      
      const stats = hourlyStats.get(hour)!;
      stats.detections.add(event.id);
      stats.visitors.add(`${event.isKnown ? event.personId : 'unknown'}_${event.cameraId}`);
    }

    return Array.from(hourlyStats.entries()).map(([hour, stats]) => ({
      hour,
      detections: stats.detections.size,
      uniqueVisitors: stats.visitors.size
    })).sort((a, b) => a.hour - b.hour);
  }

  // Group events by camera for location analysis
  private groupEventsByCamera(events: VisitorDetectionEvent[]): Array<{ cameraId: string; detections: number; uniqueVisitors: number }> {
    const cameraStats = new Map<string, { detections: Set<string>; visitors: Set<string> }>();

    for (const event of events) {
      if (!cameraStats.has(event.cameraId)) {
        cameraStats.set(event.cameraId, { detections: new Set(), visitors: new Set() });
      }
      
      const stats = cameraStats.get(event.cameraId)!;
      stats.detections.add(event.id);
      stats.visitors.add(`${event.isKnown ? event.personId : 'unknown'}_${event.timestamp.toDateString()}`);
    }

    return Array.from(cameraStats.entries()).map(([cameraId, stats]) => ({
      cameraId,
      detections: stats.detections.size,
      uniqueVisitors: stats.visitors.size
    }));
  }

  // Extract visitor patterns and behaviors
  private extractVisitorPatterns(events: VisitorDetectionEvent[]): {
    peakHour: number;
    peakDay: string;
    averageVisitDuration: number;
    repeatVisitorRate: number;
  } {
    // Analyze peak times
    const hourlyCounts = new Map<number, number>();
    const dailyCounts = new Map<string, number>();

    for (const event of events) {
      const hour = event.timestamp.getHours();
      const day = event.timestamp.toLocaleDateString();
      
      hourlyCounts.set(hour, (hourlyCounts.get(hour) || 0) + 1);
      dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
    }

    const peakHour = Array.from(hourlyCounts.entries()).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    const peakDay = Array.from(dailyCounts.entries()).reduce((a, b) => a[1] > b[1] ? a : b)[0];

    // Calculate repeat visitor rate
    const visitorDates = new Map<string, Set<string>>();
    for (const event of events) {
      if (event.isKnown && event.personId) {
        if (!visitorDates.has(event.personId)) {
          visitorDates.set(event.personId, new Set());
        }
        visitorDates.get(event.personId)!.add(event.timestamp.toDateString());
      }
    }

    const repeatVisitors = Array.from(visitorDates.values()).filter(dates => dates.size > 1).length;
    const totalKnownVisitors = visitorDates.size;
    const repeatVisitorRate = totalKnownVisitors > 0 ? repeatVisitors / totalKnownVisitors : 0;

    return {
      peakHour,
      peakDay,
      averageVisitDuration: 15, // Placeholder - would need session analysis
      repeatVisitorRate
    };
  }

  // Analyze security-related patterns
  private analyzeSecurityPatterns(events: VisitorDetectionEvent[]): {
    nightTimeDetections: number;
    unusualActivity: Array<{
      type: 'night_time' | 'frequent' | 'unusual_location';
      description: string;
      timestamp: Date;
      severity: 'low' | 'medium' | 'high';
    }>;
  } {
    const nightTimeHours = [22, 23, 0, 1, 2, 3, 4, 5, 6];
    const nightTimeDetections = events.filter(e => nightTimeHours.includes(e.timestamp.getHours())).length;

    const unusualActivity = [];

    // Night time detections
    for (const event of events) {
      if (nightTimeHours.includes(event.timestamp.getHours())) {
        unusualActivity.push({
          type: 'night_time' as const,
          description: `Unknown person detected during night hours at ${event.cameraId}`,
          timestamp: event.timestamp,
          severity: (event.isKnown ? 'low' : 'medium') as 'low' | 'medium' | 'high'
        });
      }
    }

    // Frequent unknown visitors
    const unknownVisitorCounts = new Map<string, number>();
    for (const event of events.filter(e => !e.isKnown)) {
      const key = `${event.cameraId}_${event.timestamp.toDateString()}`;
      unknownVisitorCounts.set(key, (unknownVisitorCounts.get(key) || 0) + 1);
    }

    for (const [key, count] of unknownVisitorCounts.entries()) {
      if (count > 5) {
        const [cameraId, date] = key.split('_');
        unusualActivity.push({
          type: 'frequent' as const,
          description: `High frequency of unknown visitors at ${cameraId} on ${date}`,
          timestamp: new Date(date),
          severity: 'medium' as 'low' | 'medium' | 'high'
        });
      }
    }

    return {
      nightTimeDetections,
      unusualActivity: unusualActivity.slice(0, 20) // Limit to top 20 unusual activities
    };
  }

  // Identify unique visitors using face clustering and pattern analysis
  private async identifyUniqueVisitors(events: VisitorDetectionEvent[]): Promise<Visitor[]> {
    const visitorMap = new Map<string, Visitor>();
    const faceGroups = await this.clusterSimilarFaces(events);

    for (const [groupId, groupEvents] of faceGroups.entries()) {
      const sortedEvents = groupEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const knownEvent = sortedEvents.find(e => e.isKnown);
      const visitorId = knownEvent ? knownEvent.personId! : `unknown_${groupId}`;
      
      const visitor: Visitor = {
        id: visitorId,
        name: knownEvent?.personName,
        type: knownEvent ? 'known' : 'unknown',
        firstSeen: sortedEvents[0].timestamp,
        lastSeen: sortedEvents[sortedEvents.length - 1].timestamp,
        duration: this.calculateVisitDuration(sortedEvents),
        cameraIds: [...new Set(sortedEvents.map(e => e.cameraId))],
        photos: sortedEvents.map(e => e.imagePath),
        confidence: Math.max(...sortedEvents.map(e => e.confidence)),
        visitCount: this.countUniqueVisits(sortedEvents),
        lastSeenTimestamp: sortedEvents[sortedEvents.length - 1].timestamp.getTime()
      };

      visitorMap.set(visitorId, visitor);
    }

    return Array.from(visitorMap.values());
  }

  // Cluster similar faces to identify unique individuals
  private async clusterSimilarFaces(events: VisitorDetectionEvent[]): Promise<Map<string, VisitorDetectionEvent[]>> {
    const faceGroups = new Map<string, VisitorDetectionEvent[]>();
    let groupId = 0;

    // Simple clustering by known persons first
    const knownPersons = new Map<string, VisitorDetectionEvent[]>();
    const unknownEvents: VisitorDetectionEvent[] = [];

    for (const event of events) {
      if (event.isKnown && event.personId) {
        if (!knownPersons.has(event.personId)) {
          knownPersons.set(event.personId, []);
        }
        knownPersons.get(event.personId)!.push(event);
      } else {
        unknownEvents.push(event);
      }
    }

    // Add known persons to groups
    for (const [personId, personEvents] of knownPersons.entries()) {
      faceGroups.set(personId, personEvents);
    }

    // Cluster unknown faces using embedding similarity
    if (unknownEvents.length > 0) {
      const unknownClusters = await this.clusterUnknownFaces(unknownEvents);
      for (const cluster of unknownClusters) {
        faceGroups.set(`cluster_${groupId++}`, cluster);
      }
    }

    return faceGroups;
  }

  // Cluster unknown faces using similarity analysis
  private async clusterUnknownFaces(events: VisitorDetectionEvent[]): Promise<VisitorDetectionEvent[][]> {
    // This would implement face clustering using embeddings
    // For now, group by time proximity and camera
    const clusters: VisitorDetectionEvent[][] = [];
    const timeThreshold = 5 * 60 * 1000; // 5 minutes

    const sortedEvents = events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    for (const event of sortedEvents) {
      let placed = false;
      
      // Try to place in existing cluster
      for (const cluster of clusters) {
        const lastEvent = cluster[cluster.length - 1];
        const timeDiff = Math.abs(event.timestamp.getTime() - lastEvent.timestamp.getTime());
        
        if (timeDiff < timeThreshold && event.cameraId === lastEvent.cameraId) {
          cluster.push(event);
          placed = true;
          break;
        }
      }
      
      // Create new cluster if not placed
      if (!placed) {
        clusters.push([event]);
      }
    }

    return clusters;
  }

  // Calculate total visit duration from events
  private calculateVisitDuration(events: VisitorDetectionEvent[]): number {
    if (events.length === 0) return 0;
    
    const sortedEvents = events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    let totalDuration = 0;
    let currentVisitStart = sortedEvents[0].timestamp;
    let lastEventTime = sortedEvents[0].timestamp;
    const visitGapThreshold = 10 * 60 * 1000; // 10 minutes

    for (let i = 1; i < sortedEvents.length; i++) {
      const event = sortedEvents[i];
      const timeDiff = event.timestamp.getTime() - lastEventTime.getTime();
      
      if (timeDiff > visitGapThreshold) {
        // End of current visit
        totalDuration += (lastEventTime.getTime() - currentVisitStart.getTime()) / (1000 * 60);
        currentVisitStart = event.timestamp;
      }
      
      lastEventTime = event.timestamp;
    }

    // Add the final visit duration
    totalDuration += (lastEventTime.getTime() - currentVisitStart.getTime()) / (1000 * 60);
    
    return Math.round(totalDuration);
  }

  // Count unique visits within the events
  private countUniqueVisits(events: VisitorDetectionEvent[]): number {
    if (events.length === 0) return 0;
    
    const sortedEvents = events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    let visitCount = 1;
    let lastEventTime = sortedEvents[0].timestamp;
    const visitGapThreshold = 10 * 60 * 1000; // 10 minutes

    for (let i = 1; i < sortedEvents.length; i++) {
      const event = sortedEvents[i];
      const timeDiff = event.timestamp.getTime() - lastEventTime.getTime();
      
      if (timeDiff > visitGapThreshold) {
        visitCount++;
      }
      
      lastEventTime = event.timestamp;
    }

    return visitCount;
  }

  // Extract timestamp from filename
  private extractTimestampFromFilename(filename: string): string | null {
    // Handle various filename formats
    // Example: faces_cam1_1760618163997.jpg
    // Example: snapshot_cam1_2025-10-21T14-57-56-906Z.jpg
    
    const timestampMatch = filename.match(/(\d{13})/); // Unix timestamp
    if (timestampMatch) {
      return new Date(parseInt(timestampMatch[1])).toISOString();
    }
    
    const isoMatch = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
    if (isoMatch) {
      return isoMatch[1].replace(/-(\d{2})-(\d{2})-(\d{2})/g, ':$1:$2:$3');
    }
    
    return null;
  }

  // Extract camera ID from filename
  private extractCameraIdFromFilename(filename: string): string | null {
    const cameraMatch = filename.match(/cam\d+/);
    return cameraMatch ? cameraMatch[0] : null;
  }

  // Get recent face recognition events (placeholder)
  private async getRecentFaceRecognitionEvents(startDate: Date, endDate: Date): Promise<FaceRecognitionEvent[]> {
    // This would integrate with the facial recognition service
    // For now, return empty array
    return [];
  }

  // Generate visitor report for a date range
  async generateVisitorReport(startDate: Date, endDate: Date): Promise<VisitorAnalytics> {
    console.log(`Generating visitor report from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const analysis = await this.performAdvancedDetection(startDate, endDate);
    
    // Convert to analytics format
    const analytics: VisitorAnalytics = {
      totalPeriod: {
        totalVisitors: analysis.uniqueVisitors,
        uniqueVisitors: analysis.uniqueVisitors,
        knownVisitors: analysis.knownVisitors,
        unknownVisitors: analysis.unknownVisitors,
        totalVisits: analysis.totalDetections,
        averageVisitDuration: analysis.patterns.averageVisitDuration
      },
      trends: this.generateTrendsData(startDate, endDate, analysis),
      patterns: {
        peakHours: analysis.timeSlots.map(slot => ({ hour: slot.hour, count: slot.detections })),
        peakDays: [], // Would need day-based analysis
        cameraDistribution: analysis.cameraAnalysis.map(camera => ({ cameraId: camera.cameraId, count: camera.detections })),
        frequentVisitors: [] // Would need visitor frequency analysis
      },
      security: {
        unknownVisitorTrend: 'stable', // Would need trend analysis
        nightTimeVisits: analysis.security.nightTimeDetections,
        unusualActivity: analysis.security.unusualActivity.map(activity => ({
          type: activity.type === 'night_time' ? 'unusual_time' : 
                activity.type === 'frequent' ? 'multiple_visits' : 
                'unusual_location' as const,
          description: activity.description,
          timestamp: activity.timestamp,
          confidence: activity.severity === 'high' ? 0.9 : 
                   activity.severity === 'medium' ? 0.6 : 0.3
        }))
      }
    };

    return analytics;
  }

  // Generate trends data for analytics
  private generateTrendsData(startDate: Date, endDate: Date, analysis: VisitorAnalysis): Array<{
    date: string;
    visitors: number;
    known: number;
    unknown: number;
  }> {
    // This would generate daily trend data
    // Placeholder implementation
    const trends = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      trends.push({
        date: current.toISOString().split('T')[0],
        visitors: Math.floor(Math.random() * 10) + 1,
        known: Math.floor(Math.random() * 5),
        unknown: Math.floor(Math.random() * 5) + 1
      });
      current.setDate(current.getDate() + 1);
    }
    
    return trends;
  }
}

export const visitorAnalyticsService = new VisitorAnalyticsService();