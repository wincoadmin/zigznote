/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/tests/e2e/critical-paths.test.ts', // Playwright tests - run with pnpm test:e2e
  ],
  collectCoverageFrom: ['tests/**/*.ts'],
  coverageDirectory: 'coverage/root',
  verbose: true,
  passWithNoTests: true,
};
