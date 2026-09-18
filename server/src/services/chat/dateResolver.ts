// Resolve semantic date tokens to IST day boundaries. Deterministic — the
// LLM never computes dates; it emits tokens and the server resolves them.

import { z } from 'zod';

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
export const MAX_RANGE_DAYS = 90;

export const rangeTokenSchema = z.enum([
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'this_week',
]);

export function istNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + IST_OFFSET_MS);
}

/** UTC instant of the IST midnight `offsetDays` days before today. */
export function istDayStart(offsetDays: number, now: Date = new Date()): Date {
  const shifted = istNow(now);
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCDate(shifted.getUTCDate() - offsetDays);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

export type RangeToken =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_week';

interface ResolvedRange {
  from: Date;
  to: Date;
  /** Human-readable window label, e.g. "2026-08-19 (today, IST)" */
  label: string;
}

/** YYYY-MM-DD of the instant as seen in IST (en-CA yields ISO ordering). */
function fmtDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function resolveRange(
  token: RangeToken,
  now: Date = new Date(),
): ResolvedRange {
  switch (token) {
    case 'today': {
      const from = istDayStart(0, now);
      return { from, to: new Date(from.getTime() + 24 * 60 * 60 * 1000), label: `${fmtDay(from)} (today, IST)` };
    }
    case 'yesterday': {
      const from = istDayStart(1, now);
      return { from, to: new Date(from.getTime() + 24 * 60 * 60 * 1000), label: `${fmtDay(from)} (yesterday, IST)` };
    }
    case 'last_7_days': {
      const from = istDayStart(7, now);
      return { from, to: now, label: `${fmtDay(from)} → now (last 7 days, IST)` };
    }
    case 'last_30_days': {
      const from = istDayStart(30, now);
      return { from, to: now, label: `${fmtDay(from)} → now (last 30 days, IST)` };
    }
    case 'this_week': {
      // ISO week: Monday 00:00 IST → now.
      const shifted = istNow(now);
      const weekday = (shifted.getUTCDay() + 6) % 7; // Mon=0
      const monday = new Date(shifted.getTime());
      monday.setUTCDate(monday.getUTCDate() - weekday);
      monday.setUTCHours(0, 0, 0, 0);
      const from = new Date(monday.getTime() - IST_OFFSET_MS);
      return { from, to: now, label: `${fmtDay(from)} → now (this week, IST)` };
    }
  }
}

export function resolveIsoRange(
  from: string,
  to: string,
): ResolvedRange {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new Error('Invalid ISO date range');
  }
  if (toDate <= fromDate) throw new Error('Range end must be after start');
  const spanDays = (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000);
  if (spanDays > MAX_RANGE_DAYS) {
    throw new Error(`Range too wide (max ${MAX_RANGE_DAYS} days)`);
  }
  return { from: fromDate, to: toDate, label: `${fmtDay(fromDate)} → ${fmtDay(toDate)}` };
}