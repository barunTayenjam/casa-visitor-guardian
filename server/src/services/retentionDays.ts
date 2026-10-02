/**
 * How long detection images live on disk.
 * Must follow detections_days — NOT min(detections, events): events are
 * purged sooner by default (7d vs 30d), and flooring detection retention
 * to the events policy deletes evidence early.
 */
export function resolveDetectionRetentionDays(policy: {
  detections_days: number;
  events_days: number;
}): number {
  return policy.detections_days;
}
