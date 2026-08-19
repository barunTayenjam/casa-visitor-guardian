import { describe, it, expect } from '@jest/globals';
import {
  ALIAS_MAP,
  classifyTrack,
  resolveVehicleClasses,
  VEHICLE_GROUP,
} from '../queryTools.js';
import {
  istDayStart,
  resolveRange,
  resolveIsoRange,
} from '../dateResolver.js';
import { stripUnverifiedNumbers } from '../chatService.js';

describe('classifyTrack', () => {
  it('labels ended/lost tracks as left', () => {
    expect(classifyTrack('started', 'ended')).toBe('left');
    expect(classifyTrack(null, 'lost')).toBe('left');
  });
  it('labels started tracks as returned', () => {
    expect(classifyTrack('started', 'updated')).toBe('returned');
  });
  it('labels unknown states as observed', () => {
    expect(classifyTrack(null, null)).toBe('observed');
    expect(classifyTrack('updated', 'updated')).toBe('observed');
  });
});

describe('resolveVehicleClasses', () => {
  it('maps scooter to motorcycle', () => {
    expect(resolveVehicleClasses('scooter')).toEqual(['motorcycle']);
  });
  it('maps suv to car', () => {
    expect(resolveVehicleClasses('suv')).toEqual(['car']);
  });
  it('handles generic vehicle group', () => {
    expect(resolveVehicleClasses('vehicle').sort()).toEqual([...VEHICLE_GROUP].sort());
  });
  it('returns empty for unknown vehicle', () => {
    expect(resolveVehicleClasses('helicopter')).toEqual([]);
  });
  it('covers every alias key with non-empty mapping', () => {
    for (const key of Object.keys(ALIAS_MAP)) {
      expect(ALIAS_MAP[key].length).toBeGreaterThan(0);
    }
  });
});

describe('dateResolver (IST = UTC+5:30)', () => {
  it('today resolves to IST midnight boundaries', () => {
    // 2026-08-19 10:00 UTC = 15:30 IST, same IST day (19 Aug)
    const now = new Date('2026-08-19T10:00:00Z');
    const r = resolveRange('today', now);
    expect(r.from.toISOString()).toBe('2026-08-18T18:30:00.000Z'); // 19 Aug 00:00 IST
    expect(r.to.toISOString()).toBe('2026-08-19T18:30:00.000Z'); // 20 Aug 00:00 IST
  });
  it('yesterday lands on the prior IST day', () => {
    const now = new Date('2026-08-19T10:00:00Z');
    const r = resolveRange('yesterday', now);
    expect(r.from.toISOString()).toBe('2026-08-17T18:30:00.000Z');
    expect(r.to.toISOString()).toBe('2026-08-18T18:30:00.000Z');
  });
  it('istDayStart handles IST days that differ from UTC days', () => {
    // 2026-08-19 01:00 UTC = 06:30 IST on 19 Aug → IST midnight is 18 Aug 18:30 UTC
    const start = istDayStart(0, new Date('2026-08-19T01:00:00Z'));
    expect(start.toISOString()).toBe('2026-08-18T18:30:00.000Z');
  });
  it('rejects ranges wider than 90 days', () => {
    expect(() =>
      resolveIsoRange('2026-01-01', '2026-06-01', new Date('2026-06-02T00:00:00Z')),
    ).toThrow(/Range too wide/);
  });
  it('rejects inverted ranges', () => {
    expect(() => resolveIsoRange('2026-08-19', '2026-08-18')).toThrow(/after start/);
  });
});

describe('stripUnverifiedNumbers', () => {
  const stats = JSON.stringify({ totals: { detections: 132, events: 24 }, humans: { unique: 5 } });
  it('keeps sentences whose numbers appear in the stats', () => {
    const out = stripUnverifiedNumbers('Total detections were 132 across 24 events.', stats);
    expect(out).toContain('132');
  });
  it('drops sentences containing numbers absent from the stats', () => {
    const out = stripUnverifiedNumbers('There were 3 people. Total was 999.', stats);
    expect(out).not.toContain('999');
    expect(out).toContain('3 people');
  });
});
