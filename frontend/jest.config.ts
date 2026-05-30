import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        jsx: 'react-jsx',
        module: 'ESNext',
        target: 'ESNext',
        moduleResolution: 'node',
        esModuleInterop: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@/services/api/baseClient$': '<rootDir>/src/__mocks__/services/api/baseClient.ts',
    '^@/services/api/authService$': '<rootDir>/src/__mocks__/services/api/authService.ts',
    '^@/lib/logger$': '<rootDir>/src/__mocks__/lib/logger.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.{test,spec}.{ts,tsx}'],
  transformIgnorePatterns: ['node_modules/(?!(socket\\.io-client)/)'],
  injectGlobals: true,
};

export default config;
