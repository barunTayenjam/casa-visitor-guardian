export const colors = {
  background: {
    canvas: '#050505',
    card: '#0A0A0B',
    raised: '#121215',
    input: '#1A1A1D',
    primary: '#050505',
    secondary: '#0A0A0B',
    tertiary: '#121215',
  },
  text: {
    primary: '#ECECEC',
    secondary: '#A1A1A8',
    muted: '#6B6B73',
    subtle: '#4A4A52',
  },
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.10)',
    hover: 'rgba(255, 255, 255, 0.16)',
    focus: 'rgba(255, 255, 255, 0.20)',
  },
  accent: {
    default: '#5E6AD2',
    hover: '#6E7AE0',
    glow: 'rgba(94, 106, 210, 0.18)',
  },
  status: {
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#60A5FA',
    error: '#F87171',
  },
  detection: {
    motion: '#71717A',
    person: '#5E6AD2',
    vehicle: '#FBBF24',
    face: '#A78BFA',
    package: '#38BDF8',
  },
};

export const darkColors = colors;
export const darkTokens = darkColors;
export const lightTokens = colors;

export const typography = {
  fontFamily: {
    sans: '"Geist Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"Geist Mono Variable", "JetBrains Mono", "Fira Code", monospace',
  },
  fontSize: {
    micro: '0.6875rem', // 11px
    xs: '0.75rem',      // 12px
    small: '0.8125rem',  // 13px
    sm: '0.875rem',     // 14px
    base: '0.875rem',   // 14px (default body per spec)
    h3: '1.125rem',     // 18px
    h2: '1.5rem',       // 24px
    h1: '2rem',         // 32px
    display: '3rem',    // 48px
  },
  letterSpacing: {
    tight: '-0.02em',
    tighter: '-0.03em',
    tightest: '-0.04em',
    wide: '0.04em',
  },
};

export const radius = {
  controls: '4px',
  cards: '8px',
  popovers: '12px',
  modals: '16px',
  pill: '9999px',
};

export const bezier = {
  spring: 'cubic-bezier(0.32, 0.72, 0, 1)',
  smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
  snappy: 'cubic-bezier(0.16, 1, 0.3, 1)',
};

export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.5)',
  md: '0 4px 12px rgba(0,0,0,0.4)',
  lg: '0 8px 24px rgba(0,0,0,0.4)',
  accentGlow: '0 0 0 1px rgba(94,106,210,0.2), 0 0 20px rgba(94,106,210,0.1)',
};
