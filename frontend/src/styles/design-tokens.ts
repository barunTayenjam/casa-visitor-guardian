export const colors = {
  background: {
    primary: '#050505',
    secondary: '#0a0a0a',
    tertiary: '#121212',
  },
  text: {
    primary: '#f5f5f5',
    secondary: '#a3a3a3',
    muted: '#666666',
  },
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.10)',
    hover: 'rgba(255, 255, 255, 0.15)',
  },
  glass: {
    light: 'rgba(255, 255, 255, 0.03)',
    medium: 'rgba(255, 255, 255, 0.06)',
    heavy: 'rgba(255, 255, 255, 0.10)',
  },
  status: {
    success: '#22c55e',
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

export const darkColors = colors;
export const darkTokens = darkColors;
export const lightTokens = {
  ...colors,
  background: { primary: '#ffffff', secondary: '#fafafa', tertiary: '#f5f5f5' },
  text: { primary: '#0a0a0a', secondary: '#525252', muted: '#a3a3a3' },
};

export const typography = {
  fontFamily: {
    sans: '"Geist", "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },
  fontSize: {
    xs: '0.6875rem',
    sm: '0.8125rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.375rem',
    '2xl': '1.75rem',
    '3xl': '2.5rem',
    '4xl': '3.5rem',
  },
};

export const radius = {
  pill: '9999px',
  squircle: '1.25rem',
  squircleLg: '1.75rem',
  squircleSm: '0.75rem',
};

export const bezier = {
  spring: 'cubic-bezier(0.32, 0.72, 0, 1)',
  smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
  snappy: 'cubic-bezier(0.16, 1, 0.3, 1)',
};

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
  md: '0 4px 12px rgba(0, 0, 0, 0.4)',
  lg: '0 8px 30px rgba(0, 0, 0, 0.5)',
  xl: '0 20px 60px rgba(0, 0, 0, 0.6)',
  glow: '0 0 40px rgba(59, 130, 246, 0.15)',
  diffuse: '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.2)',
};

export const zIndex = {
  base: 0,
  dock: 40,
  overlay: 30,
  modal: 50,
  toast: 60,
  noise: 100,
};
