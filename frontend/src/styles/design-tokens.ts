/**
 * Design Tokens for SentryVision UI
 * Modern Minimalist Style - Clean, Professional, Unifi/Ring-inspired
 * Supports both dark and light themes via CSS custom properties
 */

// Dark theme tokens (default)
export const darkColors = {
  background: {
    primary: '#0a0e27',
    secondary: '#151932',
    tertiary: '#1e293b',
  },
  text: {
    primary: '#f1f5f9',
    secondary: '#94a3b8',
    muted: '#64748b',
  },
  border: {
    subtle: '#1e293b',
    default: '#334155',
    hover: '#475569',
  },
  interactive: {
    hover: 'rgba(255, 255, 255, 0.05)',
    active: 'rgba(255, 255, 255, 0.08)',
    focus: 'rgba(59, 130, 246, 0.15)',
  },
  glass: {
    light: 'rgba(15, 23, 42, 0.6)',
    medium: 'rgba(15, 23, 42, 0.8)',
    heavy: 'rgba(15, 23, 42, 0.95)',
  },
};

// Light theme tokens — WCAG AA compliant (4.5:1 minimum contrast)
export const lightColors = {
  background: {
    primary: '#ffffff',
    secondary: '#f8fafc',
    tertiary: '#f1f5f9',
  },
  text: {
    primary: '#0f172a',   // slate-950 — 15.4:1 on white
    secondary: '#475569', // slate-600 — 7.0:1 on white
    muted: '#64748b',     // slate-500 — 4.6:1 on white
  },
  border: {
    subtle: '#f1f5f9',
    default: '#e2e8f0',
    hover: '#cbd5e1',
  },
  interactive: {
    hover: 'rgba(0, 0, 0, 0.04)',
    active: 'rgba(0, 0, 0, 0.06)',
    focus: 'rgba(59, 130, 246, 0.15)',
  },
  glass: {
    light: 'rgba(255, 255, 255, 0.6)',
    medium: 'rgba(255, 255, 255, 0.8)',
    heavy: 'rgba(255, 255, 255, 0.95)',
  },
};

// Shared theme tokens (work in both modes)
export const colors = {
  ...darkColors,
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  detection: {
    motion: '#f59e0b',
    person: '#22c55e',
    vehicle: '#3b82f6',
    face: '#8b5cf6',
    package: '#06b6d4',
  },
};

// Export darkTokens alias for plan reference
export const darkTokens = darkColors;
export const lightTokens = lightColors;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
};

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
};

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
};

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
};

export const typography = {
  fontFamily: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '2rem',    // 32px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
};
