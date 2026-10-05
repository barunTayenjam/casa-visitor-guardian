/**
 * The list API returns detection metadata; this is where it was dropped.
 *
 * `useEventsList` mapped `object_detections` down to type/confidence/name and
 * a bounding box, discarding track id, tracklet length, verification tier and
 * person attributes — so the detail panel had nothing to render even after the
 * server started persisting them. Extracted here so the mapping can be tested.
 */

import { describe, expect, it } from 'vitest';
import type { MotionEvent } from '@/types/security';
import { mapEnhancedEvent } from './mapEnhancedEvent';

const VERIFICATION = {
  verified: true,
  tier: 'pose',
  keypoints: 14,
  faceDetected: false,
  elapsedMs: 42,
  pose: { stance: 'standing', facing: 'away', arms_raised: false, torso_lean_deg: 3.5 },
};

function rawEvent(over: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    event_type: 'person',
    filename: 'motion_cam2_2026-10-05T07-00-00-000Z_t42.jpg',
    timestamp: '2026-10-05T07:00:00.000Z',
    cameraId: 'cam2',
    cameraName: 'Gate',
    confidence: 0.9,
    metadata: { bboxSpace: 'image', humanVerification: VERIFICATION },
    imageUrl: '/api/events/evt-1/image',
    persons_detected: 1,
    faces_detected: 0,
    known_faces_count: 0,
    unknown_faces_count: 0,
    object_detections: [
      {
        confidence: 90,
        class: 'person',
        bbox: { x: 1890, y: 320, width: 219, height: 536 },
        trackId: 42,
        trackletLen: 7,
        trackState: 'tracked',
        identity: null,
        humanVerified: true,
        verificationTier: 'pose',
        personAttributes: { clothing: 'dark jacket', facing: 'north' },
      },
    ],
    face_detections: null,
    ...over,
  } as never;
}

describe('mapEnhancedEvent', () => {
  it('keeps every detection field the panel needs', () => {
    const event: MotionEvent = mapEnhancedEvent(rawEvent());

    expect(event.detections).toHaveLength(1);
    expect(event.detections?.[0]).toMatchObject({
      type: 'person',
      confidence: 0.9,
      class: 'person',
      trackId: 42,
      trackletLen: 7,
      verificationTier: 'pose',
      humanVerified: true,
      identity: null,
      personAttributes: { clothing: 'dark jacket', facing: 'north' },
      boundingBox: { x: 1890, y: 320, width: 219, height: 536 },
    });
  });

  it('passes metadata through untouched', () => {
    const event: MotionEvent = mapEnhancedEvent(rawEvent());

    expect(event.metadata).toEqual({
      bboxSpace: 'image',
      humanVerification: VERIFICATION,
    });
  });

  it('does not treat an unknown face as known', () => {
    const event: MotionEvent = mapEnhancedEvent(
      rawEvent({
        object_detections: [{ confidence: 0.8, class: 'person', identity: 'unknown' }],
      }),
    );

    expect(event.detections?.[0].isKnown).toBe(false);
  });

  it('defaults a missing bounding box instead of drawing one at 0 size', () => {
    const event: MotionEvent = mapEnhancedEvent(
      rawEvent({ object_detections: [{ confidence: 0.5, class: 'car' }] }),
    );

    expect(event.detections?.[0].boundingBox).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('derives the label the list shows', () => {
    expect(mapEnhancedEvent(rawEvent()).labels).toEqual(['person']);
    expect(mapEnhancedEvent(rawEvent({ event_type: undefined, labels: undefined })).labels).toEqual([
      'motion',
    ]);
  });

  it('feeds the detail panel everything it renders', async () => {
    const { detectionInfo } = await import('@/lib/detectionMeta');
    const event: MotionEvent = mapEnhancedEvent(rawEvent());
    const info = detectionInfo(event);

    expect(info.tier).toBe('pose');
    expect(info.verified).toBe(true);
    expect(info.summary).toContainEqual({ label: 'Track', value: '#42 · 7 hits' });
    expect(info.attributes).toContainEqual({ label: 'Clothing', value: 'dark jacket' });
    expect(info.pose).toContainEqual({ label: 'Stance', value: 'standing' });
  });
});
