import { describe, it, expect } from '@jest/globals';

// The detection-image purge must follow the detections retention policy —
// using min(detection, event) deletes 30-day detection evidence at 7 days
// whenever events are purged sooner (the default).
describe('detection retention resolution', () => {
  it('uses detections_days, never the events floor (defaults: 30 vs 7 → 30)', async () => {
    const { resolveDetectionRetentionDays } = await import('./retentionDays.js');
    expect(resolveDetectionRetentionDays({ detections_days: 30, events_days: 7 })).toBe(30);
  });

  it('still honours a shorter detection policy when explicitly configured', async () => {
    const { resolveDetectionRetentionDays } = await import('./retentionDays.js');
    expect(resolveDetectionRetentionDays({ detections_days: 10, events_days: 30 })).toBe(10);
  });
});
