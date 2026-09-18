export const colors = {
  background: {
    primary: '#0a0a0b',
    secondary: '#111113',
    tertiary: '#18181b',
  },
  text: {
    primary: '#f5f5f5',
    secondary: '#d4d4d8',
    muted: '#8c8c8c',
  },
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.10)',
    hover: 'rgba(255, 255, 255, 0.16)',
    focus: 'rgba(255, 255, 255, 0.20)',
  },
  glass: {
    light: 'rgba(255, 255, 255, 0.04)',
    medium: 'rgba(255, 255, 255, 0.06)',
    heavy: 'rgba(255, 255, 255, 0.10)',
  },
  status: {
    success: '#22c55e',
    warning: '#eab308',
    error: '#ef4444',
    info: '#3b82f6',
  },
  detection: {
    motion: '#71717a',
    person: '#3b82f6',
    vehicle: '#f59e0b',
    face: '#8b5cf6',
    package: '#06b6d4',
  },
};

export const darkColors = colors;
export const darkTokens = darkColors;
export const lightTokens = {
  ...colors,
  background: { primary: '#ffffff', secondary: '#fafafa', tertiary: '#f5f5f5' },
  text: { primary: '#0a0a0a', secondary: '#525252', muted: '#a3a3a3' },
};

export const typography = {
  fontFamily: {
    sans: '"Geist Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"Geist Mono", "JetBrains Mono", "Fira Code", monospace',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.25rem',
    xl: '1.5rem',
    '2xl': '2rem',
    '3xl': '3rem',
    '4xl': '4.5rem',
  },
  letterSpacing: {
    tight: '-0.02em',
    tighter: '-0.04em',
  },
};

export const radius = {
  pill: '9999px',
  squircle: '1.25rem',
  squircleLg: '1.75rem',
  squircleSm: '0.5rem',
};

export const bezier = {
  spring: 'cubic-bezier(0.32, 0.72, 0, 1)',
  smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
  snappy: 'cubic-bezier(0.16, 1, 0.3, 1)',
};

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
  md: '0 6px 20px rgba(0, 0, 0, 0.45)',
  lg: '0 12px 40px rgba(0, 0, 0, 0.6)',
  xl: '0 24px 80px rgba(0, 0, 0, 0.75)',
  glow: '0 0 50px rgba(59, 130, 246, 0.25)',
  diffuse: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)',
};

export const zIndex = {
  base: 0,
  dock: 40,
  overlay: 30,
  modal: 50,
  toast: 60,
  noise: 100,
};
