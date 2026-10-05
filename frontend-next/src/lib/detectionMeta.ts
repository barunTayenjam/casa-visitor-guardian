/**
 * Pure derivation of what the events UI should show about a detection.
 *
 * Two consumers, no overlap:
 *   - the detail panel renders `summary`, `pose` and `attributes`
 *     (what was detected);
 *   - the side panel renders `verification` with `tier`/`verified`
 *     (how it was confirmed).
 *
 * The panel used to read `lightLevel` and `motionArea` — keys the pipeline
 * stopped emitting — and came out empty while Python measured tier, pose and
 * person attributes on every person track. Kept free of React so it can be
 * unit tested against the exact event shape the list API returns.
 */

export interface DetectionMetaRow {
  label: string;
  value: string;
}

export interface DetectionInfo {
  summary: DetectionMetaRow[];
  verification: DetectionMetaRow[];
  pose: DetectionMetaRow[];
  attributes: DetectionMetaRow[];
  tier: string | null;
  verified: boolean | null;
}

interface DetectionLike {
  type?: string;
  class?: string;
  identity?: string | null;
  trackId?: number;
  trackletLen?: number | null;
  verificationTier?: string | null;
  humanVerified?: boolean;
  personAttributes?: Record<string, unknown> | null;
}

interface PoseLike {
  stance?: string | null;
  facing?: string | null;
  arms_raised?: boolean | null;
  torso_lean_deg?: number | null;
}

interface VerificationLike {
  verified?: boolean;
  tier?: string;
  keypoints?: number;
  faceDetected?: boolean;
  elapsedMs?: number;
  pose?: PoseLike | null;
}

export interface DetectionInfoInput {
  detections?: DetectionLike[] | null;
  metadata?: Record<string, unknown> | null;
}

const ATTRIBUTE_LABELS: Record<string, string> = {
  clothing: 'Clothing',
  clothing_colors: 'Colors',
  facing: 'Facing',
  distance: 'Distance',
  action: 'Action',
  actions: 'Actions',
  body_language: 'Body language',
  posture: 'Posture',
  position: 'Position',
  zone: 'Zone',
};

function labelFor(key: string): string {
  const known = ATTRIBUTE_LABELS[key];
  if (known) return known;
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function usableValue(value: unknown): unknown | undefined {
  if (typeof value === 'string') {
    return value !== '' && value !== 'unknown' ? value : undefined;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const kept = value.filter((entry) => !(typeof entry === 'string' && (entry === '' || entry === 'unknown')));
    return kept.length > 0 ? kept : undefined;
  }
  return undefined;
}

function labelKey(label: string): string {
  return label.toLowerCase().replace(/\s+deg$/, '').trim();
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function verificationFrom(
  metadata: Record<string, unknown> | null | undefined,
): VerificationLike | null {
  const hv = metadata?.humanVerification;
  if (!hv || typeof hv !== 'object') return null;
  return hv as VerificationLike;
}

function poseRows(pose: PoseLike | null | undefined): DetectionMetaRow[] {
  if (!pose || typeof pose !== 'object') return [];

  const rows: DetectionMetaRow[] = [];
  if (typeof pose.stance === 'string' && pose.stance !== 'unknown') {
    rows.push({ label: 'Stance', value: pose.stance });
  }
  if (typeof pose.facing === 'string' && pose.facing !== 'unknown') {
    rows.push({ label: 'Facing', value: pose.facing });
  }
  if (typeof pose.arms_raised === 'boolean') {
    rows.push({ label: 'Arms raised', value: pose.arms_raised ? 'Yes' : 'No' });
  }
  if (typeof pose.torso_lean_deg === 'number' && Number.isFinite(pose.torso_lean_deg)) {
    rows.push({ label: 'Torso lean', value: `${pose.torso_lean_deg}°` });
  }
  return rows;
}

function attributeRows(
  attributes: Record<string, unknown> | null | undefined,
  taken: Set<string>,
): DetectionMetaRow[] {
  if (!attributes || typeof attributes !== 'object') return [];

  const rows: DetectionMetaRow[] = [];
  for (const [key, raw] of Object.entries(attributes)) {
    const value = usableValue(raw);
    if (value === undefined) continue;
    const label = labelFor(key);
    if (taken.has(labelKey(label))) continue;
    rows.push({ label, value: formatValue(value) });
  }
  return rows;
}

function primaryDetection(detections: DetectionLike[] | null | undefined): DetectionLike | null {
  if (!Array.isArray(detections) || detections.length === 0) return null;
  return detections[0] ?? null;
}

export function detectionInfo(event: DetectionInfoInput): DetectionInfo {
  const primary = primaryDetection(event.detections);
  const verification = verificationFrom(event.metadata);

  const summary: DetectionMetaRow[] = [];
  if (primary?.class) summary.push({ label: 'Class', value: primary.class });
  if (primary?.trackId !== undefined && primary.trackId !== null) {
    const hits = typeof primary.trackletLen === 'number' ? ` · ${primary.trackletLen} hits` : '';
    summary.push({ label: 'Track', value: `#${primary.trackId}${hits}` });
  }
  if (primary?.identity && primary.identity !== 'unknown') {
    summary.push({ label: 'Identity', value: primary.identity });
  }

  const verificationRows: DetectionMetaRow[] = [];
  if (typeof verification?.keypoints === 'number') {
    verificationRows.push({ label: 'Pose keypoints', value: String(verification.keypoints) });
  }
  if (typeof verification?.faceDetected === 'boolean') {
    verificationRows.push({ label: 'Face detected', value: verification.faceDetected ? 'Yes' : 'No' });
  }
  if (typeof verification?.elapsedMs === 'number') {
    verificationRows.push({ label: 'Check latency', value: `${verification.elapsedMs} ms` });
  }

  const tier = verification?.tier ?? primary?.verificationTier ?? null;
  const verified = verification?.verified ?? primary?.humanVerified ?? null;
  const pose = poseRows(verification?.pose);
  const taken = new Set([...summary, ...pose].map((row) => labelKey(row.label)));

  return {
    summary,
    verification: verificationRows,
    pose,
    attributes: attributeRows(primary?.personAttributes, taken),
    tier: tier ?? null,
    verified: verified ?? null,
  };
}
