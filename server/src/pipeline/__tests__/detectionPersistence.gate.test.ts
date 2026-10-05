/**
 * Persistence gate for person events.
 *
 * Live symptom: the events page filled with non-human snapshots — a parked
 * Bolero and a motorcycle in an empty courtyard — persisted as
 * event_type='person'.
 *
 * HumanVerifier's `score_floor` tier accepts a track on YOLO confidence alone
 * when neither uniface nor MediaPipe found anything, and neither YOLO score nor
 * bbox aspect ratio separates real people from ghosts in this data (their score
 * distributions are near-identical). The discriminating signal is persistence:
 * an intermittent false positive is seen once and gone for minutes, so its
 * tracklet never accumulates hits. A person walking through does.
 *
 * That gate did not exist here. This function persisted every person event it
 * was handed, and when Python withheld the snapshot it synthesised an image from
 * the live frame — so a rejected track still produced a row and a JPEG.
 * Python's PERSON_MIN_TRACK_HITS only decided *who wrote the picture*, never
 * *whether an event existed*.
 */

import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

process.env.NODE_ENV = 'test';

jest.unstable_mockModule('../../models/Event.js', () => ({
  Event: class {
    static create = jest.fn();
  },
}));
jest.unstable_mockModule('../../models/EventDetection.js', () => ({
  EventDetection: class {
    static create = jest.fn();
  },
}));
jest.unstable_mockModule('../../models/HumanVerification.js', () => ({
  HumanVerification: class {
    static create = jest.fn();
  },
}));
jest.unstable_mockModule('../../database.js', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));
jest.unstable_mockModule('../../services/serviceRegistry.js', () => ({
  serviceRegistry: { getStreamManager: jest.fn(() => undefined) },
}));
jest.unstable_mockModule('../../services/notificationService.js', () => ({
  default: class {},
}));
jest.unstable_mockModule('../../services/sceneMemoryService.js', () => ({
  isSceneMemoryEnabled: jest.fn(() => false),
  compareEventToBaseline: jest.fn(() => true),
}));
jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const save = jest.fn();
const insert = jest.fn();
const eventCreate = jest.fn();

function personEvent(over: Record<string, unknown> = {}) {
  return {
    cameraId: 'cam1',
    event: 'track_started',
    trackId: 1,
    class: 'person',
    classId: 0,
    score: 0.62,
    bbox: [44, 231, 75, 68],
    trackletLen: 1,
    ...over,
  };
}

describe('person persistence gate', () => {
  const OLD_ENV = process.env;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let persistDetectionEvent: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let AppDataSource: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let HumanVerification: any;

  beforeEach(async () => {
    process.env = { ...OLD_ENV, PERSON_MIN_TRACK_HITS: '3', PERSON_MIN_CONFIDENCE: '0.55' };
    jest.clearAllMocks();

    AppDataSource = (await import('../../database.js')).AppDataSource;
    AppDataSource.getRepository.mockReturnValue({ save, insert });

    HumanVerification = (await import('../../models/HumanVerification.js')).HumanVerification;
    HumanVerification.create.mockImplementation(eventCreate);

    ({ persistDetectionEvent } = await import('../detectionPersistence.js'));
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('drops a single-hit ghost instead of persisting it', async () => {
    await persistDetectionEvent(personEvent({ trackletLen: 1 }));

    expect(save).not.toHaveBeenCalled();
    expect(eventCreate).not.toHaveBeenCalled();
  });

  it('persists a person whose track survived the required hits', async () => {
    await persistDetectionEvent(personEvent({ trackletLen: 5, score: 0.8 }));

    expect(save).toHaveBeenCalled();
  });

  it('drops a weak-confidence track even when it persists long enough', async () => {
    await persistDetectionEvent(personEvent({ trackletLen: 9, score: 0.3 }));

    expect(save).not.toHaveBeenCalled();
  });

  it('drops an explicitly rejected human verification', async () => {
    await persistDetectionEvent(
      personEvent({
        trackletLen: 5,
        score: 0.8,
        humanVerification: { verified: false, tier: 'score_floor', keypoints: 0 },
      }),
    );

    expect(save).not.toHaveBeenCalled();
    expect(eventCreate).not.toHaveBeenCalled();
  });

  it('does not gate vehicles on track length', async () => {
    await persistDetectionEvent(personEvent({ class: 'car', trackletLen: 1, score: 0.7 }));

    expect(save).toHaveBeenCalled();
  });

  it('treats a missing trackletLen as not-yet-confirmed for persons', async () => {
    await persistDetectionEvent(personEvent({ trackletLen: undefined }));

    expect(save).not.toHaveBeenCalled();
  });
});
