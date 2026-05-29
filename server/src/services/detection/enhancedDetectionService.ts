import { Repository } from 'typeorm';
import { DetectionConfig } from '../../models/DetectionConfig.js';
import { Event } from '../../models/Event.js';
import { Timeline } from '../../models/Timeline.js';
import { TimelineService } from '../timeline/timelineService.js';
import { DetectionResult } from '../../detection/consolidatedDetectionService.js';
import { cacheService } from '../cacheService.js';

export interface EnhancedDetectionData {
  id: string;
  cameraId: string;
  timestamp: Date;
  eventType: 'motion' | 'person' | 'face' | 'object' | 'vehicle' | 'animal';
  confidence: number;
  detections: Array<{
    class: string;
    confidence: number;
    bbox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    label?: string;
    isKnown?: boolean;
  }>;
  metadata: {
    personCount: number;
    faceCount: number;
    vehicleCount: number;
    animalCount: number;
    objectCounts: Record<string, number>;
    processingTime: number;
    lightLevel?: number;
    motionArea?: number;
    hasPersons: boolean;
    hasFaces: boolean;
    knownFaces: number;
    unknownFaces: number;
    totalDetections: number;
    uniqueClasses: string[];
    [key: string]: any;
  };
  filePath?: string;
  thumbnailPath?: string;
}

export interface DetectionQuery {
  cameraId?: string;
  eventType?: string;
  after?: Date;
  before?: Date;
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

export class EnhancedDetectionService {
  constructor(
    private readonly eventRepo: Repository<Event>,
    private readonly timelineService: TimelineService,
    private readonly configRepo: Repository<DetectionConfig>,
  ) {}

  /**
   * Save detection event to both events table and timeline
   */
  async saveDetection(detectionData: EnhancedDetectionData): Promise<Event> {
    // Create event record
    const event = this.eventRepo.create({
      event_type: detectionData.eventType,
      file_path: detectionData.filePath || '',
      thumbnail_path: detectionData.thumbnailPath || null,
      timestamp: detectionData.timestamp,
      camera_id: detectionData.cameraId,
      metadata: JSON.stringify(detectionData.metadata),
      confidence: detectionData.confidence,
      persons_detected: detectionData.metadata.personCount,
      faces_detected: detectionData.metadata.faceCount,
      known_faces_count: detectionData.metadata.knownFaces,
      unknown_faces_count: detectionData.metadata.unknownFaces,
      object_detections: detectionData.detections,
      face_detections: detectionData.detections.filter(d => d.class.includes('face')),
    });

    const savedEvent = await this.eventRepo.save(event);

    // Add to timeline as well for unified tracking
    await this.timelineService.addTimelineEvent({
      timestamp: detectionData.timestamp,
      camera: detectionData.cameraId,
      source: 'tracked_object',
      sourceId: savedEvent.id,
      classType: detectionData.eventType,
      data: {
        ...detectionData.metadata,
        detections: detectionData.detections,
        confidence: detectionData.confidence,
      },
    });

    return savedEvent;
  }

  /**
   * Process and save detection results with enhanced metadata
   */
  async processDetectionResults(
    cameraId: string,
    frame: Buffer,
    detections: DetectionResult[],
    eventType: 'motion' | 'person' | 'face' | 'object' | 'vehicle' | 'animal' = 'object',
    processingTime: number = 0,
    filePath?: string
  ): Promise<Event> {
    // Calculate enhanced metadata
    const metadata = this.calculateEnhancedMetadata(detections, processingTime);

    // Determine primary confidence as the highest among all detections
    const confidence = metadata.totalDetections > 0 
      ? Math.max(...detections.map(d => d.confidence))
      : 0;

    // Create detection data object
    const detectionData: EnhancedDetectionData = {
      id: `det_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      cameraId,
      timestamp: new Date(),
      eventType,
      confidence,
      detections: detections.map(d => ({
        class: d.class,
        confidence: d.confidence,
        bbox: d.bbox,
      })),
      metadata,
      filePath,
    };

    // Save to database
    return await this.saveDetection(detectionData);
  }

  /**
   * Calculate enhanced metadata from detection results
   */
  private calculateEnhancedMetadata(detections: DetectionResult[], processingTime: number): EnhancedDetectionData['metadata'] {
    const personCount = detections.filter(d => d.class === 'person').length;
    const faceCount = detections.filter(d => d.class.includes('face') || d.class === 'face').length;
    const vehicleCount = detections.filter(d => ['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(d.class)).length;
    const animalCount = detections.filter(d => ['dog', 'cat', 'bird', 'horse', 'sheep', 'cow'].includes(d.class)).length;
    
    // Count unique object classes
    const uniqueClasses = new Set(detections.map(d => d.class));
    const objectCounts: Record<string, number> = {};
    uniqueClasses.forEach(cls => {
      objectCounts[cls] = detections.filter(d => d.class === cls).length;
    });

    // Determine if there are known/unknown faces
    const knownFaces = detections.filter(d => d.class.includes('face') && d.label && d.label !== 'Unknown').length;
    const unknownFaces = detections.filter(d => d.class.includes('face') && (!d.label || d.label === 'Unknown')).length;

    return {
      personCount,
      faceCount,
      vehicleCount,
      animalCount,
      objectCounts,
      processingTime,
      hasPersons: personCount > 0,
      hasFaces: faceCount > 0,
      knownFaces,
      unknownFaces,
      totalDetections: detections.length,
      uniqueClasses: Array.from(uniqueClasses),
    };
  }

  /**
   * Get detection events with advanced filtering
   */
  async getDetections(query: DetectionQuery): Promise<{
    events: Event[];
    totalCount: number;
  }> {
    let queryBuilder = this.eventRepo.createQueryBuilder('event')
      .where('1 = 1'); // Base condition

    if (query.cameraId) {
      queryBuilder = queryBuilder.andWhere('event.camera_id = :cameraId', { cameraId: query.cameraId });
    }

    if (query.eventType) {
      queryBuilder = queryBuilder.andWhere('event.event_type = :eventType', { eventType: query.eventType });
    }

    if (query.after) {
      queryBuilder = queryBuilder.andWhere('event.timestamp >= :after', { after: query.after });
    }

    if (query.before) {
      queryBuilder = queryBuilder.andWhere('event.timestamp <= :before', { before: query.before });
    }

    if (query.minConfidence !== undefined) {
      queryBuilder = queryBuilder.andWhere('event.confidence >= :minConfidence', { minConfidence: query.minConfidence });
    }

    // Get total count
    const totalCount = await queryBuilder.getCount();

    // Apply ordering and limits
    queryBuilder = queryBuilder
      .orderBy('event.timestamp', 'DESC')
      .limit(query.limit || 50);

    if (query.offset) {
      queryBuilder = queryBuilder.offset(query.offset);
    }

    const events = await queryBuilder.getMany();

    return { events, totalCount };
  }

  /**
   * Get detection statistics
   */
  async getDetectionStats(cameraId?: string): Promise<{
    totalDetections: number;
    byType: Record<string, number>;
    byDay: Record<string, number>;
    avgConfidence: number;
  }> {
    let queryBuilder = this.eventRepo.createQueryBuilder('event')
      .select([
        'COUNT(*) as totalDetections',
        'event.event_type as eventType',
        'DATE(event.timestamp) as day',
        'AVG(event.confidence) as avgConfidence'
      ])
      .groupBy('event.event_type')
      .addGroupBy('DATE(event.timestamp)');

    if (cameraId) {
      queryBuilder = queryBuilder.where('event.camera_id = :cameraId', { cameraId });
    }

    const results = await queryBuilder.getRawMany();

    const stats = {
      totalDetections: 0,
      byType: {} as Record<string, number>,
      byDay: {} as Record<string, number>,
      avgConfidence: 0,
    };

    let totalConfidence = 0;
    let confidenceCount = 0;

    results.forEach(row => {
      stats.totalDetections += parseInt(row.totalDetections);
      stats.byType[row.eventType] = (stats.byType[row.eventType] || 0) + parseInt(row.totalDetections);
      stats.byDay[row.day] = (stats.byDay[row.day] || 0) + parseInt(row.totalDetections);
      
      if (row.avgConfidence !== null) {
        totalConfidence += parseFloat(row.avgConfidence) * parseInt(row.totalDetections);
        confidenceCount += parseInt(row.totalDetections);
      }
    });

    stats.avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    return stats;
  }

  /**
   * Update detection event
   */
  async updateDetection(id: string, updates: Partial<Event>): Promise<Event | null> {
    const existing = await this.eventRepo.findOne({ where: { id } });
    if (!existing) {
      return null;
    }

    Object.assign(existing, updates);
    return await this.eventRepo.save(existing);
  }

  /**
   * Delete detection event
   */
  async deleteDetection(id: string): Promise<boolean> {
    const result = await this.eventRepo.delete(id);
    return result.affected !== 0;
  }
}