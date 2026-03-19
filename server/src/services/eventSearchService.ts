import { AppDataSource } from '../database.js';
import { Event } from '../models/Event.js';

interface EventSearchFilters {
  startDate?: string;
  endDate?: string;
  cameraId?: string;
  eventType?: string;
  confidence?: string;
  faceStatus?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

interface EventSearchResponse {
  events: any[];
  pagination: {
    page: number;
    pageSize: number;
    totalEvents: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

class EventSearchService {
  private eventRepository = AppDataSource.getRepository(Event);

  private getConfidenceThreshold(level: string): number {
    switch (level) {
      case 'low':
        return 0;
      case 'medium':
        return 0.5;
      case 'high':
        return 0.8;
      default:
        return 0;
    }
  }

  async searchEvents(filters: EventSearchFilters): Promise<EventSearchResponse> {
    const query = this.eventRepository.createQueryBuilder('event');

    if (filters.startDate) {
      query.andWhere('event.timestamp >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      query.andWhere('event.timestamp <= :endDate', { endDate: filters.endDate });
    }

    if (filters.cameraId) {
      query.andWhere('event.camera_id = :cameraId', { cameraId: filters.cameraId });
    }

    if (filters.eventType) {
      query.andWhere('event.event_type = :eventType', { eventType: filters.eventType });
    }

    if (filters.confidence) {
      const minConfidence = this.getConfidenceThreshold(filters.confidence);
      query.andWhere('event.confidence >= :minConfidence', { minConfidence });
    }

    if (filters.faceStatus === 'recognized') {
      query.andWhere('event.known_faces_count > 0');
    } else if (filters.faceStatus === 'unknown') {
      query.andWhere('event.faces_detected > 0').andWhere('event.known_faces_count = 0');
    } else if (filters.faceStatus === 'none') {
      query.andWhere('event.faces_detected = 0');
    }

    const page = filters.page || 1;
    const pageSize = Math.min(filters.pageSize || 20, 100);
    const offset = (page - 1) * pageSize;

    const sortBy = filters.sortBy || 'timestamp';
    const sortOrder = filters.sortOrder || 'DESC';

    const validSortFields = ['timestamp', 'confidence', 'camera_id'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'timestamp';

    query.orderBy(`event.${sortField}`, sortOrder);

    const [events, totalEvents] = await query
      .skip(offset)
      .take(pageSize)
      .getManyAndCount();

    const totalPages = Math.ceil(totalEvents / pageSize);

    return {
      events: events.map((event) => ({
        id: event.id,
        eventType: event.event_type,
        timestamp: event.timestamp,
        cameraId: event.camera_id,
        confidence: event.confidence,
        personsDetected: event.persons_detected,
        facesDetected: event.faces_detected,
        knownFacesCount: event.known_faces_count,
        unknownFacesCount: event.unknown_faces_count,
        objectDetections: event.object_detections || [],
        faceDetections: event.face_detections || [],
        imageUrl: event.file_path ? `/api/events/image/${event.file_path.split('/').pop()}` : null,
        metadata: event.metadata ? JSON.parse(event.metadata) : null,
      })),
      pagination: {
        page,
        pageSize,
        totalEvents,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }
}

export default new EventSearchService();
