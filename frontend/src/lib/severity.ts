/**
 * Severity Classification System for Motion Alerts
 *
 * Classifies motion detection events into severity levels based on:
 * - Object type (person, vehicle, animal, package)
 * - Confidence score (0-100)
 * - Detection zone (front door = higher priority)
 */

export enum AlertSeverity {
  CRITICAL = 'critical',
  IMPORTANT = 'important',
  INFORMATIONAL = 'info'
}

export interface SeverityConfig {
  objectWeights: Record<string, number>;
  confidenceThresholds: {
    critical: number;
    important: number;
  };
  zoneOverrides: Record<string, number>;
}

const DEFAULT_CONFIG: SeverityConfig = {
  // Higher weight = more severe
  objectWeights: {
    'person': 10,
    'car': 6,
    'dog': 4,
    'cat': 3,
    'package': 7,
    'unknown': 2
  },
  confidenceThresholds: {
    critical: 70,  // High confidence for critical
    important: 50  // Medium confidence for important
  },
  // Zones that increase severity
  zoneOverrides: {
    'front_steps': 2,    // Front door area
    'driveway': 1.5,     // Vehicle access
    'street': 1,         // Public area
    'back_patio': 1.2,   // Back yard
    'gate': 1.8          // Entry point
  }
};

/**
 * Calculate severity score based on object type and confidence
 */
function calculateSeverityScore(
  objectType: string,
  confidence: number,
  zone?: string
): number {
  const config = DEFAULT_CONFIG;
  const objectWeight = config.objectWeights[objectType] || config.objectWeights.unknown;
  const zoneMultiplier = zone ? (config.zoneOverrides[zone] || 1) : 1;

  return objectWeight * (confidence / 100) * zoneMultiplier;
}

/**
 * Classify a motion detection event into severity level
 *
 * @param objectType - Type of object detected (person, car, dog, etc.)
 * @param confidence - Confidence score (0-100)
 * @param zone - Detection zone identifier (optional)
 * @returns AlertSeverity level
 */
export function classifyAlert(
  objectType: string,
  confidence: number,
  zone?: string
): AlertSeverity {
  const score = calculateSeverityScore(objectType, confidence, zone);

  // Critical: Person + high confidence, or any object in high-priority zone with high confidence
  if (
    (objectType === 'person' && confidence >= DEFAULT_CONFIG.confidenceThresholds.critical) ||
    score >= 8
  ) {
    return AlertSeverity.CRITICAL;
  }

  // Important: Medium confidence detection, or vehicle/package
  if (
    confidence >= DEFAULT_CONFIG.confidenceThresholds.important ||
    score >= 4
  ) {
    return AlertSeverity.IMPORTANT;
  }

  // Informational: Low confidence, animals, or distant detections
  return AlertSeverity.INFORMATIONAL;
}

/**
 * Get severity configuration (for testing and customization)
 */
export function getSeverityConfig(): SeverityConfig {
  return { ...DEFAULT_CONFIG };
}

/**
 * Update severity configuration (for user preferences)
 */
export function updateSeverityConfig(updates: Partial<SeverityConfig>): void {
  Object.assign(DEFAULT_CONFIG, updates);
}
