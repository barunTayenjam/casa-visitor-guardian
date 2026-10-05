/**
 * Detection metadata must reach the events UI instead of the dead keys.
 *
 * The panel used to render `lightLevel` and `motionArea`, fields the pipeline
 * stopped emitting, so the block came out empty even though Python measures
 * verification tier, pose (stance / facing / arms raised / torso lean) and
 * person attributes on every person track and Node now persists them.
 *
 * Two groups with two consumers, kept non-overlapping on purpose: the detail
 * panel shows summary/pose/attributes, the side panel shows verification.
 */

import { describe, expect, it } from 'vitest';
import { detectionInfo } from './detectionMeta';

function event(over: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    cameraId: 'cam2',
    timestamp: new Date('2026-10-05T07:00:00Z'),
    confidence: 0.9,
    labels: ['person'],
    detections: [],
    metadata: {},
    ...over,
  } as never;
}

const VERIFICATION = {
  verified: true,
  tier: 'pose',
  keypoints: 14,
  faceDetected: false,
  elapsedMs: 42,
  pose: {
    stance: 'standing',
    facing: 'away',
    arms_raised: false,
    torso_lean_deg: 3.5,
    keypoints: 14,
  },
};

const ATTRIBUTES = {
  clothing: 'dark jacket',
  clothing_colors: ['black', 'navy'],
  facing: 'north',
  distance: 'mid',
  action: 'walking',
};

describe('detectionInfo', () => {
  it('returns nothing to show for an event with no detections and no metadata', () => {
    const info = detectionInfo(event());

    expect(info.summary).toEqual([]);
    expect(info.verification).toEqual([]);
    expect(info.pose).toEqual([]);
    expect(info.attributes).toEqual([]);
    expect(info.tier).toBeNull();
    expect(info.verified).toBeNull();
  });

  it('survives the dead keys being gone', () => {
    const info = detectionInfo(event({ metadata: { bboxSpace: 'image' } }));

    expect(info.summary).toEqual([]);
    expect(info.verification).toEqual([]);
  });

  it('describes the primary detection', () => {
    const info = detectionInfo(
      event({
        detections: [
          {
            type: 'person',
            confidence: 0.9,
            class: 'person',
            trackId: 42,
            trackletLen: 7,
            identity: 'unknown',
          },
        ],
      }),
    );

    expect(info.summary).toContainEqual({ label: 'Class', value: 'person' });
    expect(info.summary).toContainEqual({ label: 'Track', value: '#42 · 7 hits' });
    expect(info.summary.some((row) => row.label === 'Identity')).toBe(false);
  });

  it('names a known identity', () => {
    const info = detectionInfo(
      event({ detections: [{ type: 'person', confidence: 0.9, identity: 'Barun' }] }),
    );

    expect(info.summary).toContainEqual({ label: 'Identity', value: 'Barun' });
  });

  it('reads the verification verdict and pose from metadata', () => {
    const info = detectionInfo(event({ metadata: { humanVerification: VERIFICATION } }));

    expect(info.tier).toBe('pose');
    expect(info.verified).toBe(true);
    expect(info.verification).toContainEqual({ label: 'Pose keypoints', value: '14' });
    expect(info.verification).toContainEqual({ label: 'Face detected', value: 'No' });
    expect(info.verification).toContainEqual({ label: 'Check latency', value: '42 ms' });
    expect(info.pose).toContainEqual({ label: 'Stance', value: 'standing' });
    expect(info.pose).toContainEqual({ label: 'Facing', value: 'away' });
    expect(info.pose).toContainEqual({ label: 'Arms raised', value: 'No' });
    expect(info.pose).toContainEqual({ label: 'Torso lean', value: '3.5°' });
  });

  it('falls back to the detection tier when metadata has no verdict', () => {
    const info = detectionInfo(
      event({
        detections: [
          {
            type: 'person',
            confidence: 0.9,
            verificationTier: 'score_floor',
            humanVerified: false,
          },
        ],
      }),
    );

    expect(info.tier).toBe('score_floor');
    expect(info.verified).toBe(false);
  });

  it('renders person attributes with readable labels', () => {
    const info = detectionInfo(
      event({ detections: [{ type: 'person', confidence: 0.9, personAttributes: ATTRIBUTES }] }),
    );

    expect(info.attributes).toContainEqual({ label: 'Clothing', value: 'dark jacket' });
    expect(info.attributes).toContainEqual({ label: 'Colors', value: 'black, navy' });
    expect(info.attributes).toContainEqual({ label: 'Facing', value: 'north' });
    expect(info.attributes).toContainEqual({ label: 'Distance', value: 'mid' });
    expect(info.attributes).toContainEqual({ label: 'Action', value: 'walking' });
  });

  it('ignores attributes the analyzer could not measure', () => {
    const info = detectionInfo(
      event({
        detections: [{ type: 'person', confidence: 0.9, personAttributes: { clothing: 'unknown' } }],
      }),
    );

    expect(info.attributes).toEqual([]);
  });

  it('splits camelCase attribute keys into readable labels', () => {
    const info = detectionInfo(
      event({
        detections: [
          {
            type: 'person',
            confidence: 0.9,
            personAttributes: {
              armsRaised: false,
              bodyLanguage: 'neutral',
              carryingItem: 'bag',
              torsoLeanDeg: -12.4,
            },
          },
        ],
      }),
    );

    expect(info.attributes).toContainEqual({ label: 'Arms raised', value: 'No' });
    expect(info.attributes).toContainEqual({ label: 'Body language', value: 'neutral' });
    expect(info.attributes).toContainEqual({ label: 'Carrying item', value: 'bag' });
    expect(info.attributes).toContainEqual({ label: 'Torso lean deg', value: '-12.4' });
  });

  it('drops list attributes whose entries are all unknown', () => {
    const info = detectionInfo(
      event({
        detections: [
          { type: 'person', confidence: 0.9, personAttributes: { actions: ['unknown'] } },
        ],
      }),
    );

    expect(info.attributes).toEqual([]);
  });

  it('keeps only the known entries of a partially unknown list', () => {
    const info = detectionInfo(
      event({
        detections: [
          { type: 'person', confidence: 0.9, personAttributes: { actions: ['walking', 'unknown'] } },
        ],
      }),
    );

    expect(info.attributes).toContainEqual({ label: 'Actions', value: 'walking' });
  });

  it('lets the pose rows win when an attribute repeats the same measurement', () => {
    const info = detectionInfo(
      event({
        metadata: { humanVerification: VERIFICATION },
        detections: [
          {
            type: 'person',
            confidence: 0.9,
            personAttributes: {
              facing: 'north',
              armsRaised: true,
              torsoLeanDeg: 0,
              clothing: 'dark jacket',
            },
          },
        ],
      }),
    );

    expect(info.pose).toContainEqual({ label: 'Facing', value: 'away' });
    expect(info.pose).toContainEqual({ label: 'Torso lean', value: '3.5°' });
    expect(info.attributes.map((row) => row.label)).toEqual(['Clothing']);
  });

  it('drops a pose of all-unknown values rather than showing noise', () => {
    const info = detectionInfo(
      event({
        metadata: {
          humanVerification: {
            ...VERIFICATION,
            pose: { stance: 'unknown', facing: 'unknown', arms_raised: null, torso_lean_deg: null },
          },
        },
      }),
    );

    expect(info.pose).toEqual([]);
  });

  it('does not crash on partial metadata', () => {
    const info = detectionInfo(event({ metadata: { humanVerification: { tier: 'face' } } }));

    expect(info.tier).toBe('face');
    expect(info.pose).toEqual([]);
    expect(info.summary).toEqual([]);
    expect(info.verification).toEqual([]);
  });
});
