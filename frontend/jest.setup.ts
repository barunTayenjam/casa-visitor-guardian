import '@testing-library/jest-dom';

interface ImportMetaEnv {
  DEV: boolean;
  PROD: boolean;
  MODE: string;
  BASE_URL: string;
  [key: string]: unknown;
}

const env = (import.meta as Record<string, unknown>).env as ImportMetaEnv | undefined;
if (!env) {
  (import.meta as Record<string, unknown>).env = {
    DEV: true,
    PROD: false,
    MODE: 'development',
    BASE_URL: '/'
  };
}
