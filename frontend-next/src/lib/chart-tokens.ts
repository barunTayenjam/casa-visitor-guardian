/**
 * Chart color palette — derived from DESIGN.md tokens.
 *
 * Each entry uses CSS custom properties so charts respond to theme changes.
 * Hex fallbacks are provided for Recharts (it requires concrete fill values).
 *
 * Roles: primary (indigo), status (success/warning/danger/info),
 * and 5-series divergent set for stacked bars.
 */

/* Status colors (used on donuts: severity, threat level) */
export const STATUS = {
  danger: '#F87171',
  warning: '#FBBF24',
  success: '#34D399',
  info: '#60A5FA',
  muted: '#6B6B73',
} as const;

/* Threat donut: maps threat level names → status colors */
export const THREAT_COLORS: Record<string, string> = {
  critical: STATUS.danger,
  high: '#EC835A',
  medium: STATUS.warning,
  low: STATUS.success,
  unknown: STATUS.muted,
};

/* Threat stacked bars: 4-level subset */
export const THREAT: Record<string, string> = {
  critical: STATUS.danger,
  high: '#EC835A',
  medium: STATUS.warning,
  low: STATUS.success,
};

/* Severity donut */
export const SEVERITY_COLORS: Record<string, string> = {
  alert: STATUS.danger,
  detection: STATUS.info,
  info: STATUS.muted,
};

/* 5-series stacked bars — indigo-based ramp, desaturated for dark UI */
export const SERIES = {
  person: '#5E6AD2',
  vehicle: '#60A5FA',
  motion: '#A78BFA',
  animal: '#34D399',
  other: '#F59E0B',
} as const;

/* Tooltip — dark-native, matches --popover surface */
export const TOOLTIP_STYLE = {
  backgroundColor: '#0A0A0B',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '8px',
  color: '#ECECEC',
  fontSize: 12,
  padding: '8px 12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
};

/* Shared tick styling for axes */
export const AXIS_STYLE = {
  fontSize: 10,
  fill: '#6B6B73',
  fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
};

/* Grid line style — subtle, barely visible */
export const GRID_STYLE = {
  strokeDasharray: '3 3',
  stroke: 'rgba(255,255,255,0.04)',
};
