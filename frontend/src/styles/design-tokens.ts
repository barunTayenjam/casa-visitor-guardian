/**
 * Design Tokens for SentryVision UI
 * Modern Minimalist Style - Clean, Professional, Unifi/Ring-inspired
 */

export const colors = {
  // Base colors
  background: {
    primary: '#0a0e27',    // Deep navy - main background
    secondary: '#151932',  // Lighter navy - panels/cards
    tertiary: '#1e293b',   // Slate - elevated surfaces
  },
  
  // Text colors
  text: {
    primary: '#f1f5f9',    // Off-white - primary text
    secondary: '#94a3b8',  // Gray - secondary text
    muted: '#64748b',      // Darker gray - labels, hints
  },
  
  // Border & Dividers
  border: {
    subtle: '#1e293b',     // Very subtle border
    default: '#334155',    // Default border
    hover: '#475569',      // Hover border
  },
  
  // Status colors - Minimalist palette
  status: {
    success: '#10b981',    // Green - healthy, recording
    warning: '#f59e0b',    // Amber - caution
    error: '#ef4444',      // Red - critical, offline
    info: '#3b82f6',       // Blue - informational
  },
  
  // Detection type colors
  detection: {
    motion: '#f59e0b',     // Amber - motion events
    person: '#22c55e',     // Green - person detection
    vehicle: '#3b82f6',    // Blue - vehicle detection
    face: '#8b5cf6',       // Purple - face recognition
    package: '#06b6d4',    // Cyan - package detection
  },
  
  // Interactive states
  interactive: {
    hover: 'rgba(255, 255, 255, 0.05)',
    active: 'rgba(255, 255, 255, 0.08)',
    focus: 'rgba(59, 130, 246, 0.15)',
  },
  
  // Glassmorphism
  glass: {
    light: 'rgba(15, 23, 42, 0.6)',
    medium: 'rgba(15, 23, 42, 0.8)',
    heavy: 'rgba(15, 23, 42, 0.95)',
  },
};

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
