import type { MotionEvent } from '@/types/security';
import type { EnhancedEvent } from '@/services/api/eventService';

/**
 * Turn a `list-enhanced` row into the view model the events page renders.
 *
 * Extracted from `useEventsList` because the inline version copied only type,
 * confidence and a bounding box — dropping track id, tracklet length,
 * verification tier and person attributes, which is why the detail panel had
 * nothing to show once the server started persisting them.
 */
export function mapEnhancedEvent(event: EnhancedEvent): MotionEvent {
  return {
    id: event.id,
    cameraId: event.cameraId,
    cameraName: event.cameraName || `Camera ${event.cameraId}`,
    timestamp: new Date(event.timestamp),
    imageUrl: event.imageUrl || null,
    confidence: event.confidence,
    labels: event.labels || [event.event_type || 'motion'],
    location: event.cameraName || '',
    duration: 0,
    archived: false,
    metadata: event.metadata,
    detections: (event.object_detections || []).map((d) => ({
      type: (d.class === 'person' || d.class === 'face' ? d.class : 'object') as
        | 'person'
        | 'face'
        | 'object',
      confidence:
        typeof d.confidence === 'number' && d.confidence > 1 ? d.confidence / 100 : d.confidence,
      name: d.identity ?? undefined,
      isKnown: !!d.identity && d.identity !== 'unknown',
      class: d.class,
      identity: d.identity,
      trackId: d.trackId,
      trackletLen: d.trackletLen,
      verificationTier: d.verificationTier,
      humanVerified: d.humanVerified,
      personAttributes: d.personAttributes,
      boundingBox: {
        x: d.bbox?.x ?? 0,
        y: d.bbox?.y ?? 0,
        width: d.bbox?.width ?? 0,
        height: d.bbox?.height ?? 0,
      },
    })),
    personCount: event.persons_detected,
    faceCount: event.faces_detected,
    knownFaces: event.known_faces_count,
    unknownFaces: event.unknown_faces_count,
    severity: event.severity,
  };
}
