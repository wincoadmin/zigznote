/**
 * Jest test setup file
 * Runs after environment is set up but before tests
 */

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
beforeAll(() => {
  // Setup code that runs once before all tests
});

afterAll(() => {
  // Cleanup code that runs once after all tests
});

beforeEach(() => {
  // Reset mocks between tests
  jest.clearAllMocks();
});
