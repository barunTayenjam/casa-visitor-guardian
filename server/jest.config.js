export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true
    }]
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/tests/**'
  ],
  coverageThreshold: {
    // Regression floor, not a quality target: these sit just below the real
    // global coverage (~20-24% as of 2026-10) so the gate catches total
    // collapse instead of failing permanently. Raise as coverage grows.
    global: {
      branches: 18,
      functions: 18,
      lines: 20,
      statements: 20
    }
  },
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverage: true
};
