import '@testing-library/jest-dom';

// Mock import.meta.env for Vitest-like environment in Jest
// Note: This only works if the code handles potential undefined or if transformed
if (typeof (import.meta as any).env === 'undefined') {
  (import.meta as any).env = {
    DEV: true,
    PROD: false,
    MODE: 'development',
    BASE_URL: '/'
  };
}
